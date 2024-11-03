import { Entity, Column, PrimaryGeneratedColumn, Unique, Index } from 'typeorm';

@Entity('btc_history_tx')
@Unique('UQ_HASH', ['hash'])
@Unique('UQ_SORT', ['sort'])
@Index('IDX_VERSION_SORT', ['version', 'sort'])
@Index('IDX_PREV', ['prev'])
export class BtcHistoryTx {
  @PrimaryGeneratedColumn()
  id?: number

  @Column({ name: 'version', type: 'varchar', length: 6 })
  version: string

  @Column({ name: 'block_height', type: 'int' })
  blockHeight: number

  @Column({ name: 'block_timestamp', type: 'int' })
  blockTimestamp: number

  @Column({ name: 'hash', type: 'varchar', length: 66 })
  hash: string

  @Column({ name: 'content', type: 'text' })
  content: string

  @Column({ name: 'prev', type: 'varchar', length: 66, default: null })
  prev: string

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number

  @Column({ name: 'is_executed', type: 'boolean', default: false })
  isExecuted: boolean
}