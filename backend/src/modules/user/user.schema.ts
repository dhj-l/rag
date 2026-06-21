import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';
import { Role, UserStatus } from '../../common/types/common.types';

/**
 * User Mongoose Schema（users 集合，ARCHITECTURE.md §3.2）
 *
 * - username：唯一索引
 * - password：bcrypt 哈希，默认 select:false（登录时显式 select）
 * - timestamps：自动维护 createdAt / updatedAt
 */
@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  username!: string;

  @Prop({ type: String, required: true, select: false })
  password!: string;

  @Prop({ type: String, required: true, trim: true })
  displayName!: string;

  @Prop({ type: String, required: true, enum: Object.values(Role) })
  role!: Role;

  @Prop({ type: [String], required: true, default: [] })
  departments!: string[];

  @Prop({ type: String, required: true, enum: Object.values(UserStatus), default: UserStatus.ACTIVE })
  status!: UserStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

/**
 * 用户响应（不含密码，§3.6 UserResponse）
 * 供登录返回 / 用户列表 / profile 接口使用。
 */
export interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  departments: string[];
  status: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

/** mongoose _id → id 的最小投影（供 toResponse 用） */
export interface UserLean {
  _id: MSchema.Types.ObjectId | string;
  username: string;
  displayName: string;
  role: Role;
  departments: string[];
  status: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
