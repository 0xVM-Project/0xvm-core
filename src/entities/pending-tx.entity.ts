import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

@Entity('pending_tx')
@Unique('idx_order_id', ['orderId'])
@Index('idx_status', ['status'])
export class PendingTx {
  @PrimaryGeneratedColumn()
  id?: number

  @Column({name: 'order_id', type: 'varchar', length: 64})
  orderId: string

  @Column({ name: 'from_address', type: 'varchar', length: 128, default: 'withdraw address(btc address)' })
  fromAddress: string

  @Column({ name: 'content', type: 'mediumtext', comment: 'inscription content' })
  content: string

  @Column({ name: 'fee', type: "int", default: 0 , comment: 'fee'})
  fee: number

  @Column({ name: 'hash', type: 'varchar', default: ''})
  hash: string

  @Column({ name: 'status', type: 'int', default: 1, comment: '-1:Failed, 0:Pending, 1:Broadcast completed, 2:Pre-Confirmed' })
  status?: number

  @CreateDateColumn({ name: 'create_time', type: 'timestamp'})
  createTime?: Date

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date
}