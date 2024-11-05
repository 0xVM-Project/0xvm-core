import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pre_broadcast_tx_item')
export class PreBroadcastTxItem {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    name: 'pre_execution_id',
    type: 'int',
    nullable: false,
    default: 0,
    unsigned: true,
  })
  @Index()
  preExecutionId: number;

  @Column({
    name: 'type',
    type: 'tinyint',
    nullable: false,
    default: 1,
    unsigned: true,
    comment: '1: normal 2: pre',
  })
  @Index()
  type: number;

  @Column({
    name: 'action',
    type: 'tinyint',
    nullable: false,
    default: 0,
    unsigned: true,
    comment:
      '0: prev 1: deploy 2: execute 3: transfer 3: deposit 3: withdraw 3: mineBlock',
  })
  @Index()
  action: number;

  @Column({
    name: 'data',
    type: 'text',
    nullable: false,
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  data: string;

  @Column({
    name: 'xvm_block_height',
    type: 'int',
    nullable: false,
    default: 0,
    unsigned: true,
  })
  @Index()
  xvmBlockHeight: number;

  @CreateDateColumn({ name: 'create_time', type: 'timestamp' })
  createTime?: Date;

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date;
}
