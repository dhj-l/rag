/**
 * 数据库初始化脚本：创建测试账号
 *
 * 运行：pnpm seed  （package.json: tsx src/scripts/seed.ts）
 *
 * 参考 ARCHITECTURE.md T02 实现要点 5。
 */
import 'reflect-metadata';
import { config } from 'dotenv';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role, UserStatus } from '../common/types/common.types';
import { User, UserDocument, UserSchema } from '../modules/user/user.schema';

// 加载 .env（与后端运行时一致）
config();

interface SeedUser {
  username: string;
  password: string;
  displayName: string;
  role: Role;
  departments: string[];
}

const SEED_USERS: SeedUser[] = [
  { username: 'admin',    password: 'admin123', displayName: '管理员', role: Role.ADMIN,    departments: [] },
  { username: 'zhangsan', password: '123456',   displayName: '张三',   role: Role.EMPLOYEE, departments: ['技术部'] },
  { username: 'lisi',     password: '123456',   displayName: '李四',   role: Role.EMPLOYEE, departments: ['市场部'] },
  { username: 'wangwu',   password: '123456',   displayName: '王五',   role: Role.MANAGER,  departments: ['技术部'] },
  { username: 'zhaoliu',  password: '123456',   displayName: '赵六',   role: Role.MANAGER,  departments: ['市场部'] },
  { username: 'sunqi',    password: '123456',   displayName: '孙七',   role: Role.CEO,      departments: [] },
];

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/doc_assistant'),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
})
class SeedModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const UserModel = app.get<Model<UserDocument>>(getModelToken(User.name));

    for (const u of SEED_USERS) {
      const existing = await UserModel.findOne({ username: u.username }).exec();
      if (existing) {
        console.log(`ℹ️   ${u.username} 已存在，跳过。`);
        continue;
      }

      const password = await bcrypt.hash(u.password, 10);
      await UserModel.create({
        username: u.username,
        password,
        displayName: u.displayName,
        role: u.role,
        departments: u.departments,
        status: UserStatus.ACTIVE,
      });

      console.log(`✅ ${u.username} / ${u.password}  (${u.displayName}, ${u.role})`);
    }

    console.log('\n🎉 全部 seed 完成。');
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('❌ seed 失败：', err);
  process.exit(1);
});
