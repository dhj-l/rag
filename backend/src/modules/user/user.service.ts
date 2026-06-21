import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { AuditAction, UserContext, UserStatus } from '../../common/types/common.types';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto';
import { User, UserDocument, UserResponse } from './user.schema';

/**
 * 用户业务服务（§3.6 用户管理接口）
 *
 * 所有写操作通过 AuditService 记录审计（login 由 AuthService 记录；
 * 此处记录 role_change / 用户创建 / 启停）。
 */
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  /** 登录用：显式 select password */
  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).select('+password').exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** 转 UserContext（供 JwtStrategy / 审计使用） */
  toContext(user: UserDocument): UserContext {
    return {
      userId: String(user._id),
      username: user.username,
      role: user.role,
      departments: user.departments ?? [],
    };
  }

  /** 转 UserResponse（剥离 password） */
  toResponse(user: UserDocument): UserResponse {
    return {
      id: String(user._id),
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      departments: user.departments ?? [],
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /** 分页列表（admin） */
  async findAll(query: UserListQueryDto): Promise<{ list: UserResponse[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 20);
    const skip = (page - 1) * pageSize;

    const [docs, total] = await Promise.all([
      this.userModel.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.userModel.countDocuments().exec(),
    ]);

    return { list: docs.map((d) => this.toResponse(d)), total };
  }

  /** 创建用户 */
  async create(dto: CreateUserDto, operator: UserContext): Promise<UserResponse> {
    const exists = await this.userModel.findOne({ username: dto.username }).exec();
    if (exists) {
      throw new HttpException('用户名已存在', HttpStatus.CONFLICT);
    }

    const password = await bcrypt.hash(dto.password, 10);
    const created = await this.userModel.create({
      username: dto.username,
      password,
      displayName: dto.displayName,
      role: dto.role,
      departments: dto.departments ?? [],
      status: UserStatus.ACTIVE,
    });

    // 创建即赋角色，记为 role_change
    await this.auditService.record({
      user: operator,
      action: AuditAction.ROLE_CHANGE,
      resource: 'user',
      resourceId: String(created._id),
      filterCondition: { role: dto.role, departments: dto.departments },
    });

    return this.toResponse(created);
  }

  /** 更新角色/部门 */
  async updateRole(id: string, dto: UpdateUserDto, operator: UserContext): Promise<UserResponse> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }

    const before = { role: user.role, departments: user.departments };
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.departments !== undefined) user.departments = dto.departments;
    await user.save();

    await this.auditService.record({
      user: operator,
      action: AuditAction.ROLE_CHANGE,
      resource: 'user',
      resourceId: String(user._id),
      filterCondition: { before, after: { role: user.role, departments: user.departments } },
    });

    return this.toResponse(user);
  }

  /** 启用/禁用 */
  async updateStatus(id: string, status: UserStatus, operator: UserContext): Promise<UserResponse> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }

    const before = user.status;
    user.status = status;
    await user.save();

    // §3.7 AuditAction 无 status 变更类型，归入 role_change（resourceId 记用户 id）
    await this.auditService.record({
      user: operator,
      action: AuditAction.ROLE_CHANGE,
      resource: 'user',
      resourceId: String(user._id),
      filterCondition: { before, after: status },
    });

    return this.toResponse(user);
  }

  /** 按 ids 批量查（供审计/其他模块复用） */
  async findByIds(filter: FilterQuery<UserDocument>): Promise<UserDocument[]> {
    return this.userModel.find(filter).exec();
  }
}
