export class Zombie {
  readonly id: string;
  x: number;
  y: number;
  readonly maxHealth: number;
  readonly moveSpeedTilesPerSecond: number;
  readonly attackRange: number;
  readonly attackDamage: number;
  readonly attackCooldownSeconds: number;

  private attackCooldownRemainingSeconds = 0;
  health: number;

  constructor(
    id: string,
    x: number,
    y: number,
    maxHealth = 40,
    moveSpeedTilesPerSecond = 1.8,
    attackRange = 0.72,
    attackDamage = 8,
    attackCooldownSeconds = 0.75
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.maxHealth = Math.max(1, maxHealth);
    this.health = this.maxHealth;
    this.moveSpeedTilesPerSecond = Math.max(0.1, moveSpeedTilesPerSecond);
    this.attackRange = Math.max(0.1, attackRange);
    this.attackDamage = Math.max(1, attackDamage);
    this.attackCooldownSeconds = Math.max(0.05, attackCooldownSeconds);
  }

  advance(deltaSeconds: number): void {
    this.attackCooldownRemainingSeconds = Math.max(0, this.attackCooldownRemainingSeconds - deltaSeconds);
  }

  canAttack(): boolean {
    return this.attackCooldownRemainingSeconds <= 1e-6;
  }

  triggerAttackCooldown(): void {
    this.attackCooldownRemainingSeconds = this.attackCooldownSeconds;
  }

  applyDamage(amount: number): boolean {
    const normalized = Math.max(0, amount);
    this.health = Math.max(0, this.health - normalized);
    return this.health <= 0;
  }
}
