import * as walletQuery from '../query/wallets.query';

export const getWallets = async () => {
  const { data, error } = await walletQuery.fetchWallets();
  if (error) throw new Error(error.message);
  return data;
};

export const createWallet = async (body: any) => {
  const { name, type, balance, color, icon } = body;

  if (!name || !type) {
    throw { status: 400, message: 'Nama dan Tipe dompet wajib diisi!' };
  }

  const payload = {
    name,
    type,
    balance: parseFloat(balance) || 0,
    color: color || '#2563eb',
    icon: icon || 'landmark',
  };

  const { data, error } = await walletQuery.insertWallet(payload);
  if (error) throw new Error(error.message);
  return data[0];
};

export const editWallet = async (body: any) => {
  const { id, name, type, balance, color, icon } = body;

  if (!id) {
    throw { status: 400, message: 'ID Dompet wajib dikirim!' };
  }

  const payload = {
    name,
    type,
    balance: parseFloat(balance) || 0,
    color: color || '#2563eb',
    icon: icon || 'landmark',
  };

  const { data, error } = await walletQuery.updateWallet(id, payload);
  if (error) throw new Error(error.message);
  return data[0];
};

export const removeWallet = async (body: any) => {
  const { id } = body;
  if (!id) throw { status: 400, message: 'ID Dompet wajib dikirim!' };

  const { error } = await walletQuery.deleteWallet(id);
  if (error) throw new Error(error.message);
  return { message: 'Berhasil' };
};
