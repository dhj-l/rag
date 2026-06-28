import { Test } from '@nestjs/testing';
import { PermissionService } from './permission.service';
import { Role, SecurityLevel, UserContext } from '../../common/types/common.types';

/**
 * PermissionService 权限逻辑单元测试
 * 覆盖 §3.8 权限矩阵：buildVectorFilter / buildMongoQuery / canAccessDocument。
 */
describe('PermissionService', () => {
  let service: PermissionService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionService],
    }).compile();
    service = moduleRef.get(PermissionService);
  });

  const employee: UserContext = {
    userId: 'u1',
    username: 'zhangsan',
    role: Role.EMPLOYEE,
    departments: ['信息技术部'],
  };
  const manager: UserContext = { ...employee, role: Role.MANAGER };
  const ceo: UserContext = { ...employee, role: Role.CEO };
  const admin: UserContext = { ...employee, role: Role.ADMIN };

  describe('needsDepartmentFilter', () => {
    it('employee/manager 需部门过滤，ceo/admin 不需要', () => {
      expect(service.needsDepartmentFilter(Role.EMPLOYEE)).toBe(true);
      expect(service.needsDepartmentFilter(Role.MANAGER)).toBe(true);
      expect(service.needsDepartmentFilter(Role.CEO)).toBe(false);
      expect(service.needsDepartmentFilter(Role.ADMIN)).toBe(false);
    });
  });

  describe('buildVectorFilter', () => {
    it('employee: accessibleLevels=[L1,L2], noRestriction=false', () => {
      const f = service.buildVectorFilter(employee);
      expect(f.accessibleLevels).toEqual([SecurityLevel.L1, SecurityLevel.L2]);
      expect(f.departments).toEqual(['信息技术部']);
      expect(f.noRestriction).toBe(false);
    });

    it('ceo/admin: noRestriction=true', () => {
      expect(service.buildVectorFilter(ceo).noRestriction).toBe(true);
      expect(service.buildVectorFilter(admin).noRestriction).toBe(true);
    });

    it('manager: accessibleLevels=[L1,L2,L3]', () => {
      expect(service.buildVectorFilter(manager).accessibleLevels).toEqual([
        SecurityLevel.L1,
        SecurityLevel.L2,
        SecurityLevel.L3,
      ]);
    });

    it('F-15: 传入 documentIds 时透传；空数组/不传为 undefined', () => {
      // 传入非空数组 → 透传到 VectorFilter.documentIds
      const withDocs = service.buildVectorFilter(employee, ['d1', 'd2']);
      expect(withDocs.documentIds).toEqual(['d1', 'd2']);
      // 空数组 → undefined（避免空数组造成语义歧义，等价于不限定）
      const emptyDocs = service.buildVectorFilter(employee, []);
      expect(emptyDocs.documentIds).toBeUndefined();
      // 不传第二参数 → undefined
      const noArg = service.buildVectorFilter(employee);
      expect(noArg.documentIds).toBeUndefined();
    });
  });

  describe('buildMongoQuery', () => {
    it('admin/ceo 返回空对象（全库）', () => {
      expect(service.buildMongoQuery(admin)).toEqual({});
      expect(service.buildMongoQuery(ceo)).toEqual({});
    });

    it('employee 条件含 L1 与 L2+部门', () => {
      const q = service.buildMongoQuery(employee) as { $or: unknown[] };
      expect(q.$or).toHaveLength(2);
      expect(JSON.stringify(q)).toContain('L1');
      expect(JSON.stringify(q)).toContain('L2');
      expect(JSON.stringify(q)).toContain('信息技术部');
      // L4 对 employee 不可访问，不应出现
      expect(JSON.stringify(q)).not.toContain('L4');
    });
  });

  describe('canAccessDocument', () => {
    const docL1 = { securityLevel: SecurityLevel.L1, department: 'all' } as never;
    const docL2Mine = { securityLevel: SecurityLevel.L2, department: '信息技术部' } as never;
    const docL2Other = { securityLevel: SecurityLevel.L2, department: '财务部' } as never;
    const docL3 = { securityLevel: SecurityLevel.L3, department: '信息技术部' } as never;
    const docL4 = { securityLevel: SecurityLevel.L4, department: 'all' } as never;

    it('employee: L1✓ L2本部门✓ L2他部门✗ L3✗ L4✗', () => {
      expect(service.canAccessDocument(employee, docL1)).toBe(true);
      expect(service.canAccessDocument(employee, docL2Mine)).toBe(true);
      expect(service.canAccessDocument(employee, docL2Other)).toBe(false);
      expect(service.canAccessDocument(employee, docL3)).toBe(false);
      expect(service.canAccessDocument(employee, docL4)).toBe(false);
    });

    it('manager: L3本部门✓', () => {
      expect(service.canAccessDocument(manager, docL3)).toBe(true);
    });

    it('ceo/admin: 全部✓', () => {
      for (const u of [ceo, admin]) {
        expect(service.canAccessDocument(u, docL1)).toBe(true);
        expect(service.canAccessDocument(u, docL2Other)).toBe(true);
        expect(service.canAccessDocument(u, docL3)).toBe(true);
        expect(service.canAccessDocument(u, docL4)).toBe(true);
      }
    });
  });
});
