// src/services/apiClient.ts

export interface WalletPayload {
  id?: string;
  name: string;
  type: string;
  balance?: number;
  color?: string;
  icon?: string;
}

export interface TransactionPayload {
  id?: string;
  type: string;
  amount: number | string;
  wallet_id: string;
  to_wallet_id?: string;
  category_id?: string;
  transaction_date?: string;
  notes?: string;
}

export interface CategoryPayload {
  id?: string;
  name: string;
  type: string;
  icon?: string;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const response = await fetch(endpoint, config);

    if (!response.ok) {
      let errorMessage = 'Terjadi kesalahan pada server';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Abaikan jika response bukan JSON
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  // ==================== WALLETS ====================
  async getWallets<T = any>(): Promise<T> {
    return this.request<T>('/api/wallets');
  }

  async createWallet<T = any>(payload: WalletPayload): Promise<T> {
    return this.request<T>('/api/wallets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateWallet<T = any>(payload: WalletPayload): Promise<T> {
    return this.request<T>('/api/wallets', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteWallet<T = any>(id: string): Promise<T> {
    return this.request<T>('/api/wallets', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // ==================== TRANSACTIONS ====================
  async getTransactions<T = any>(): Promise<T> {
    return this.request<T>('/api/transactions');
  }

  async createTransaction<T = any>(payload: TransactionPayload): Promise<T> {
    return this.request<T>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTransaction<T = any>(payload: TransactionPayload): Promise<T> {
    return this.request<T>('/api/transactions', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteTransaction<T = any>(id: string): Promise<T> {
    return this.request<T>('/api/transactions', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
  }

  // ==================== CATEGORIES ====================
  async getCategories<T = any>(): Promise<T> {
    return this.request<T>('/api/categories');
  }
}

export const apiClient = new ApiClient();
