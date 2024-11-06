import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('last_config')
export class LastConfig {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    name: 'last_tx_hash',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  lastTxHash: string;

  @Column({
    name: 'last_btc_block_height',
    type: 'int',
    nullable: false,
    default: 0,
    unsigned: true,
  })
  lastBtcBlockHeight: number;

  @CreateDateColumn({ name: 'create_time', type: 'timestamp' })
  createTime?: Date;

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date;
}
