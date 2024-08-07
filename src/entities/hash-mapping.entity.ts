import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('hash_mapping')
@Index('idx_btcHash_and_idx_xvmHash', ['btcHash', 'xvmHash'], { unique: true })
@Index('idx_xFromAddress', ['xFromAddress'])
export class HashMapping {
  @PrimaryGeneratedColumn()
  id?: number

  @Column({ name: 'x_from_address', type: 'varchar', length: 128, comment: 'xvm sender address', nullable: true })
  xFromAddress: string

  @Column({ name: 'x_to_address', type: 'varchar', length: 128, comment: 'xvm to address', nullable: true })
  xToAddress: string

  @Column({ name: 'btc_hash', type: 'varchar', length: 128, comment: 'btc transaction hash' })
  btcHash: string

  @Column({ name: 'xvm_hash', type: 'varchar', length: 128, comment: 'xvm transaction hash' })
  xvmHash?: string

  @Column({ name: 'log_index', type: 'int', comment: 'hash index' })
  logIndex: number

  @CreateDateColumn({ name: 'create_time', type: 'timestamp' })
  createTime?: Date

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date
}