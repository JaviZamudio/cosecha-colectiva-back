import { createPool } from 'mysql2';
import { host, user, password, database, db_url } from './config';

const db = createPool({
    connectionLimit: 10,
    uri: db_url
}).promise();

export default db;