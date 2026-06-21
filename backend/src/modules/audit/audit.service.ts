import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuditAction,
  UserContext,
  VectorFilter,
} from '../../common/types/common.types';
import { PermissionService } from '../ai/permission.service';
import { AuditLog, AuditLogDocument } from './audit.schema';

/** 审计记录入参 */
export interface AuditRecordInput {
  user: UserContext;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  filterCondition?: Record<string, unknown>;
  resultCount?: number;
  ipAddress?: string;
}

/** 审计查询结果项（脱去内部字段） */
export interface AuditLogResponse {
  id: string;
  userId: string;
  username: string;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  filterCondition?: Record<string, unknown>;
  resultCount?: number;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * 审计日志服务（§3.2 audit_logs / §7.2 / T02 实现要点 3）
 *
 * - record()：fire-and-forget，不阻塞主流程，失败仅记日志不抛。
 * - findAll()：admin 分页查询。
 * - buildFilterCondition()：复用 PermissionService，供检索类审计记录 filterCondition（T04 用）。
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    private readonly permissionService: PermissionService,
  ) {}

  /** 记录一条审计日志（异步、不阻塞主流程） */
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await this.auditModel.create({
        userId: input.user.userId,
        username: input.user.username,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        filterCondition: input.filterCondition,
        resultCount: input.resultCount,
        ipAddress: input.ipAddress,
      });
    } catch (err) {
      // 审计失败不应影响业务主流程
      this.logger.error(`审计记录写入失败: action=${input.action}`, err);
    }
  }

  /** 分页查询审计日志（admin） */
  async findAll(query: {
    page?: number;
    pageSize?: number;
    action?: AuditAction;
    username?: string;
  }): Promise<{ list: AuditLogResponse[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 20);
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.username) filter.username = { $regex: query.username, $options: 'i' };

    const [docs, total] = await Promise.all([
      this.auditModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return {
      list: docs.map((d) => this.toResponse(d)),
      total,
    };
  }

  /**
   * 构建检索操作的权限过滤条件（T04 检索审计用）
   * 复用 PermissionService.buildVectorFilter（§7.3）。
   */
  buildFilterCondition(user: UserContext): VectorFilter {
    return this.permissionService.buildVectorFilter(user);
  }

  private toResponse(doc: AuditLogDocument): AuditLogResponse {
    return {
      id: String(doc._id),
      userId: String(doc.userId),
      username: doc.username,
      action: doc.action,
      resource: doc.resource,
      resourceId: doc.resourceId,
      filterCondition: doc.filterCondition,
      resultCount: doc.resultCount,
      ipAddress: doc.ipAddress,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
    };
  }
}
