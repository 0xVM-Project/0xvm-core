import mysql from "mysql2/promise";
import {
  databaseHost,
  databaseName,
  databasePassword,
  databaseUser,
} from "./config";

export default class Database {
  private database;

  constructor() {
    this.database = mysql.createPool({
      host: databaseHost,
      user: databaseUser,
      password: databasePassword,
      database: databaseName,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  public insertWithdrawBtc = async (
    _fromAddress?: string,
    _toAddress?: string,
    _amount?: number,
    _hash?: string
  ) => {
    if (_fromAddress && _toAddress && _amount && _hash) {
      try {
        const insertQuery = `
        INSERT INTO withdraw (from_address, to_address, amount, evm_hash)
        VALUES (?, ?, ?, ?)
    `;
        const values = [_fromAddress, _toAddress, _amount, _hash];
        const [results] = await this.database.execute(insertQuery, values);
        console.log("insertWithdrawBtc:", results);
        return true;
      } catch (error) {
        console.error("insertWithdrawBtc:", error);
      }
    }

    return false;
  };
}
