import { config } from "dotenv";

config();

export const port = process.env.PORT as string;
export const db_url = process.env.CLEARDB_DATABASE_URL as string;
export const host = process.env.DB_HOST as string;
export const user = process.env.DB_USER as string;
export const password = process.env.DB_PASSWORD as string;
export const database = process.env.DB_NAME as string;
export const secret = process.env.JWT_SECRET as string;
export const node_env = process.env.NODE_ENV as "development" | "production" | "test";
export const aws_access_key_id = process.env.BUCKETEER_AWS_ACCESS_KEY_ID as string;
export const aws_secret_access_key = process.env.BUCKETEER_AWS_SECRET_ACCESS_KEY as string;
export const aws_region = process.env.BUCKETEER_AWS_REGION as string;
export const aws_bucket_name = process.env.BUCKETEER_BUCKET_NAME as string;