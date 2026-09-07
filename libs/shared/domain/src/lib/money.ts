/**
 * Value object monetario. Inmutable. Sin dependencias de Angular.
 * Se guarda el importe en la unidad menor (centavos) para evitar errores de coma flotante.
 *
 * Referencia la moneda solo por su código ISO 4217 (string), NO importa la entidad
 * `Currency` de master-data: así `Money` queda libre de dependencias de dominio.
 */
export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: string,
  ) {}

  static of(amountMajor: number, currency: string): Money {
    return new Money(Math.round(amountMajor * 100), currency.toUpperCase());
  }

  static fromMinor(amountMinor: number, currency: string): Money {
    return new Money(Math.trunc(amountMinor), currency.toUpperCase());
  }

  get amountMajor(): number {
    return this.amountMinor / 100;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
