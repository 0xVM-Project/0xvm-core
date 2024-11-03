import { Column, CreateDateColumn, Entity, UpdateDateColumn } from 'typeorm';

@Entity('last-tx-hash')
export class LastTxHash {
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
