export class RegExpStringSearch {
  private static flags(caseSensitive: boolean): string {
    return caseSensitive ? '' : 'i';
  }

  static eq(value: string, caseSensitive = false): RegExp {
    return new RegExp(`^${this.escape(value)}$`, this.flags(caseSensitive));
  }

  static contains(value: string, caseSensitive = false): RegExp {
    return new RegExp(this.escape(value), this.flags(caseSensitive));
  }

  static startsWith(value: string, caseSensitive = false): RegExp {
    return new RegExp(`^${this.escape(value)}`, this.flags(caseSensitive));
  }

  static endsWith(value: string, caseSensitive = false): RegExp {
    return new RegExp(`${this.escape(value)}$`, this.flags(caseSensitive));
  }

  static in(values: string[], caseSensitive = false): RegExp {
    const joined = values.map((v) => this.escape(v)).join('|');
    return new RegExp(`^(${joined})$`, this.flags(caseSensitive));
  }

  private static escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
