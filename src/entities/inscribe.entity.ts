import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inscribe')
export class InscribeItem {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  @Index({ unique: true })
  inscribeId: string;
  @Column({ nullable: false })
  privateKey: string;
  @Column('text', { nullable: false })
  commitTx: string;
  @Column({ nullable: false, default: '' })
  commitTxHash: string;
  @Column({ nullable: false, default: '' })
  revealHash: string;
  @Column({ nullable: false, default: 0 })
  status: number;
  @Column('text', { nullable: false })
  content: string;
  @Column({ nullable: false })
  receiverAddress: string;
  @Column('int', { nullable: false })
  feeRate: number;
  @Column('int', { nullable: false, default: 0 })
  depositAmount: number;
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
