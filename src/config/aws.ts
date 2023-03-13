import { S3 } from "aws-sdk";
import { aws_region, aws_access_key_id,aws_secret_access_key } from "./config";

export const s3 = new S3({
    region: aws_region,
    accessKeyId: aws_access_key_id,
    secretAccessKey: aws_secret_access_key
});