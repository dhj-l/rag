import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/types/common.types';
import { AuditService } from './audit.service';

/**
 * 审计日志控制器（§3.6 审计接口）
 * GET /api/audit/logs 需 admin 角色。
 */
@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 审计日志分页查询（GET /api/audit/logs，admin）
   *
   * - 权限：admin。
   * - 查询参数（均可选，string 传入，service 内转 number）：
   *   - page：页码，默认 1
   *   - pageSize：每页条数，默认 20
   *   - action：AuditAction 枚举值精确过滤（search/view_document/summarize/upload/delete/login/role_change）
   *   - username：用户名模糊匹配（大小写不敏感）
   * - 响应 data：`{ list: AuditLogResponse[], total }`，按 createdAt 倒序。
   */
  @Get('logs')
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
  ) {
    return this.auditService.findAll({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      action: action as never,
      username,
    });
  }
}
