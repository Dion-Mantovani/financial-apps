import * as transactionQuery from '../query/transactions.query';
import { getTodayInputDate } from '../utils/formatters';

export const getTransactions = async () => {
  const { data, error } = await transactionQuery.fetchTransactions();
  if (error) throw new Error(error.message);
  return data;
};

export const createTransaction = async (body: any) => {
  const {
    wallet_id,
    to_wallet_id,
    category_id,
    amount,
    type,
    notes,
    transaction_date,
  } = body;

  if (!wallet_id || !amount || !type) {
    throw {
      status: 400,
      message: 'Dompet, nominal, dan tipe transaksi wajib diisi!',
    };
  }

  if (type === 'transfer' && !to_wallet_id) {
    throw {
      status: 400,
      message: 'Dompet tujuan wajib dipilih untuk transaksi transfer!',
    };
  }

  const numericAmount = parseFloat(amount);
  const payload = {
    wallet_id,
    to_wallet_id: type === 'transfer' ? to_wallet_id : null,
    category_id: category_id || null,
    amount: numericAmount,
    type,
    notes: notes || '',
    transaction_date: transaction_date || getTodayInputDate(),
  };

  const { data: newTx, error: txError } =
    await transactionQuery.insertTransaction(payload);
  if (txError) throw new Error(txError.message);

  return newTx[0];
};

export const editTransaction = async (body: any) => {
  const {
    id,
    wallet_id,
    to_wallet_id,
    category_id,
    amount,
    type,
    notes,
    transaction_date,
  } = body;

  if (!id) throw { status: 400, message: 'ID Transaksi wajib dikirim!' };

  const payload = {
    wallet_id,
    to_wallet_id: type === 'transfer' ? to_wallet_id : null,
    category_id: category_id || null,
    amount: parseFloat(amount),
    type,
    notes: notes || '',
    transaction_date: transaction_date || new Date().toISOString(),
  };

  const { data, error } = await transactionQuery.updateTransaction(id, payload);
  if (error) throw new Error(error.message);
  return data[0];
};

export const removeTransaction = async (body: any) => {
  const { id } = body;
  if (!id) throw { status: 400, message: 'ID Transaksi wajib dikirim!' };

  const { error } = await transactionQuery.deleteTransaction(id);
  if (error) throw new Error(error.message);
  return { message: 'Transaksi berhasil dihapus' };
};
