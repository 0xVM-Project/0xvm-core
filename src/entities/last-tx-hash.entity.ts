import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('last_tx_hash')
export class LastTxHash {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    name: 'hash',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  hash: string;

  @CreateDateColumn({ name: 'create_time', type: 'timestamp' })
  createTime?: Date;

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date;
}
