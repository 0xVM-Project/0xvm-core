import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('pre-broadcast-tx')
export class PreBroadcastTx {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'inscribe_id',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  @Index({ unique: true })
  inscribeId: string;

  @Column({
    name: 'private_key',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  privateKey: string;

  @Column({
    name: 'status',
    type: 'tinyint',
    nullable: false,
    default: 0,
    unsigned: true,
    comment: '0: initial 1: packed 2: ready 3: pending 4: completed',
  })
  @Index()
  status: number;

  @Column({
    name: 'content',
    type: 'text',
    nullable: false,
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  content: string;

  @Column({
    name: 'receiver_address',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  receiverAddress: string;

  @Column({
    name: 'temporary_address',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  temporaryAddress: string;

  @Column({
    name: 'fee_rate',
    type: 'int',
    nullable: false,
    default: 0,
    unsigned: true,
  })
  feeRate: number;

  @Column({
    name: 'amount',
    type: 'int',
    nullable: false,
    default: 0,
    unsigned: true,
  })
  amount: number;

  @Column({
    name: 'commit_tx',
    type: 'text',
    nullable: false,
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  commitTx: string;

  @Column({
    name: 'commit_tx_hash',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  @Index()
  commitTxHash: string;

  @Column({
    name: 'previous',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  @Index()
  previous: string;

  @Column({
    name: 'xvm_block_hash',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  @Index()
  xvmBlockHash: string;

  @Column({
    name: 'reveal_hash',
    type: 'varchar',
    length: 256,
    nullable: false,
    default: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
  })
  revealHash: string;

  @CreateDateColumn({ name: 'create_time', type: 'timestamp' })
  createTime?: Date;

  @UpdateDateColumn({ name: 'update_time', type: 'timestamp' })
  updateTime?: Date;
}
