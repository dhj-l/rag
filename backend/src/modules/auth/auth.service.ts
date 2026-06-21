import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  AuditAction,
  JwtPayload,
  UserContext,
  UserStatus,
} from '../../common/types/common.types';
import { AuditService } from '../audit/audit.service';
import { UserService } from '../user/user.service';
import { UserResponse } from '../user/user.schema';
import { LoginDto } from './dto/login.dto';

/** 登录返回（§3.6 login 响应 data） */
export interface LoginResult {
  token: string;
  user: UserResponse;
}

/**
 * 认证服务（§3.4 JWT / §3.6 认证接口 / T02 实现要点 1）
 *
 * - login：bcrypt 校验 → 签发 JWT（role + departments，24h）→ 记录 login 审计。
 * - validatePayload：供 JwtStrategy 复用，确认用户仍存在且 active。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string): Promise<LoginResult> {
    const user = await this.userService.findByUsername(dto.username);
    if (!user) {
      throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED);
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new HttpException('用户名或密码错误', HttpStatus.UNAUTHORIZED);
    }

    if (user.status === UserStatus.DISABLED) {
      throw new HttpException('账号已被禁用，请联系管理员', HttpStatus.FORBIDDEN);
    }

    const payload: JwtPayload = {
      sub: String(user._id),
      username: user.username,
      role: user.role,
      departments: user.departments ?? [],
    };

    const token = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '24h',
    });

    // 登录成功审计
    const context: UserContext = this.userService.toContext(user);
    await this.auditService.record({
      user: context,
      action: AuditAction.LOGIN,
      ipAddress,
    });

    return { token, user: this.userService.toResponse(user) };
  }

  /** 供 JwtStrategy.validate 复用：确认用户仍存在且 active */
  async validatePayload(payload: JwtPayload): Promise<UserContext> {
    const user = await this.userService.findById(payload.sub);
    if (!user || user.status === UserStatus.DISABLED) {
      throw new HttpException('登录已失效，请重新登录', HttpStatus.UNAUTHORIZED);
    }
    return this.userService.toContext(user);
  }
}
