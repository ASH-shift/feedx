import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// ======================= Proto Loading =======================

const USER_PROTO_PATH = path.join(__dirname, '../../../proto/user.proto');
const POST_PROTO_PATH = path.join(__dirname, '../../../proto/post.proto');
const FEED_PROTO_PATH = path.join(__dirname, '../../../proto/feed.proto');

const loaderOptions: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const userPackageDef = protoLoader.loadSync(USER_PROTO_PATH, loaderOptions);
const postPackageDef = protoLoader.loadSync(POST_PROTO_PATH, loaderOptions);
const feedPackageDef = protoLoader.loadSync(FEED_PROTO_PATH, loaderOptions);

const userProto = (grpc.loadPackageDefinition(userPackageDef) as any).user;
const postProto = (grpc.loadPackageDefinition(postPackageDef) as any).post;
const feedProto = (grpc.loadPackageDefinition(feedPackageDef) as any).feed;

// ======================= gRPC Client Options =======================

const channelOptions = {
  'grpc.keepalive_time_ms': 30000,
  'grpc.keepalive_timeout_ms': 10000,
  'grpc.keepalive_permit_without_calls': true,
  'grpc.max_send_message_length': 16 * 1024 * 1024,
  'grpc.max_receive_message_length': 16 * 1024 * 1024,
};

// ======================= Service URLs =======================

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'localhost:50051';
const POST_SERVICE_URL = process.env.POST_SERVICE_URL || 'localhost:50052';
const FEED_SERVICE_URL = process.env.FEED_SERVICE_URL || 'localhost:50053';

// ======================= Raw gRPC Clients =======================

const _userClient = new userProto.UserService(
  USER_SERVICE_URL,
  grpc.credentials.createInsecure(),
  channelOptions
);

const _postClient = new postProto.PostService(
  POST_SERVICE_URL,
  grpc.credentials.createInsecure(),
  channelOptions
);

const _feedClient = new feedProto.FeedService(
  FEED_SERVICE_URL,
  grpc.credentials.createInsecure(),
  channelOptions
);

// ======================= Promise Wrappers =======================

function grpcCall<TRequest, TResponse>(
  client: any,
  method: string,
  request: TRequest
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    client[method](request, (error: grpc.ServiceError | null, response: TResponse) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

// ======================= User Client =======================

export const userClient = {
  register: (data: { username: string; email: string; password: string }) =>
    grpcCall(_userClient, 'register', data),

  login: (data: { email: string; password: string }) =>
    grpcCall(_userClient, 'login', data),

  getUser: (userId: string) =>
    grpcCall(_userClient, 'getUser', { user_id: userId }),

  followUser: (followerId: string, followingId: string) =>
    grpcCall(_userClient, 'followUser', { follower_id: followerId, following_id: followingId }),

  unfollowUser: (followerId: string, followingId: string) =>
    grpcCall(_userClient, 'unfollowUser', { follower_id: followerId, following_id: followingId }),

  getFollowers: (userId: string) =>
    grpcCall(_userClient, 'getFollowers', { user_id: userId }),

  getFollowing: (userId: string) =>
    grpcCall(_userClient, 'getFollowing', { user_id: userId }),
};

// ======================= Post Client =======================

export const postClient = {
  createPost: (userId: string, username: string, content: string) =>
    grpcCall(_postClient, 'createPost', { user_id: userId, username, content }),

  getPost: (postId: string) =>
    grpcCall(_postClient, 'getPost', { post_id: postId }),

  getUserPosts: (userId: string, page: number, limit: number) =>
    grpcCall(_postClient, 'getUserPosts', { user_id: userId, page, limit }),

  deletePost: (postId: string, userId: string) =>
    grpcCall(_postClient, 'deletePost', { post_id: postId, user_id: userId }),
};

// ======================= Feed Client =======================

export const feedClient = {
  getFeed: (userId: string, page: number, limit: number) =>
    grpcCall(_feedClient, 'getFeed', { user_id: userId, page, limit }),
};
