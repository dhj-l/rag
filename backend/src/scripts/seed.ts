/**
 * 数据库初始化脚本：创建默认管理员账号（admin / admin123）
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
    const existing = await UserModel.findOne({ username: 'admin' }).exec();

    if (existing) {
      console.log('ℹ️  默认管理员已存在，跳过创建。');
      return;
    }

    const password = await bcrypt.hash('admin123', 10);
    await UserModel.create({
      username: 'admin',
      password,
      displayName: '管理员',
      role: Role.ADMIN,
      departments: [],
      status: UserStatus.ACTIVE,
    });

    console.log('✅ 默认管理员已创建：admin / admin123');
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('❌ seed 失败：', err);
  process.exit(1);
});
