import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = path.join(__dirname, '../../../proto/user.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const userProto = protoDescriptor.user;

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'localhost:50051';

const client = new userProto.UserService(
  USER_SERVICE_URL,
  grpc.credentials.createInsecure(),
  {
    'grpc.keepalive_time_ms': 30000,
    'grpc.keepalive_timeout_ms': 10000,
    'grpc.keepalive_permit_without_calls': true,
  }
);

export function getFollowers(userId: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    client.getFollowers({ user_id: userId }, (error: grpc.ServiceError | null, response: any) => {
      if (error) {
        console.error(`[Feed Service] getFollowers gRPC error for user ${userId}:`, error.message);
        reject(error);
        return;
      }
      resolve(response.follower_ids || []);
    });
  });
}

export function getUser(userId: string): Promise<{ id: string; username: string; email: string }> {
  return new Promise((resolve, reject) => {
    client.getUser({ user_id: userId }, (error: grpc.ServiceError | null, response: any) => {
      if (error) {
        console.error(`[Feed Service] getUser gRPC error for user ${userId}:`, error.message);
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}
