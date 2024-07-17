import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

@Entity('withdraw')
@Unique('idx_evmhash', ['evmHash'])
@Index('idx_toaddress', ['toAddress'])
@Index('idx_status', ['status'])
export class Withdraw {
  @PrimaryGeneratedColumn()
  id?: number

  @Column({ name: 'from_address', type: 'varchar', length: 128, default: 'withdraw address(btc address)' })
  fromAddress: string

  @Column({ name: 'to_address', type: 'varchar', length: 128, default: 'receiving address(btc address)' })
  toAddress: string

  @Column({ name: 'amount', type: 'decimal', precision: 64, scale: 16, comment: 'uint sats' })
  amount: string

  @Column({ name: 'tx_hash', type: 'varchar', length: 256, default: 'btc trading hash' })
  txHash?: string

  @Column({ name: 'evm_hash', type: 'varchar', length: 255, default: 'xvm trading hash' })
  evmHash: string

  @Column({ name: 'status', type: 'int', default: 1, comment: '-1:Provisional failure, 1:No request sent, 2:pending, 3:to be confirmed, 4:confirmed' })
  status?: number

  @CreateDateColumn({ name: 'create_time', type: 'timestamp'})
  createTime?: Date

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date
}