import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('block_hash_snapshot')
@Index('idx_blockHash', ['blockHash'])
@Index('idx_blockHeight', ['blockHeight'])
export class BlockHashSnapshot {
  @PrimaryGeneratedColumn()
  id?: number

  @Column({ name: 'block_height', type: 'int', comment: 'block height' })
  blockHeight: number

  @Column({ name: 'block_hash', type: 'varchar', length: 128, comment: 'block hash' })
  blockHash: string

  @CreateDateColumn({ name: 'create_time', type: 'timestamp' })
  createTime?: Date

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date
}