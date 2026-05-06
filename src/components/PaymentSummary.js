import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const PaymentSummary = ({
  subtotal,
  discountPercent,
  onChangeDiscountPercent,
  discountAmount,
  onChangeDiscountAmount,
  grandTotal,
  paymentMethod,
  paymentMethodHelperText,
  onChangePaymentMethod,
  paymentMethodOptions,
  paymentStatus,
  paymentAmount,
  onChangePaymentAmount,
  changeAmount,
  paymentNotes,
  onChangePaymentNotes,
  onSaveTransaction,
  onPreviewReceipt,
  onProcessOrder,
  onCancelTransaction,
  isSubmitting,
}) => {
  const toMoney = (value) => `Rp. ${Number(value || 0).toLocaleString('id-ID')}`;
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const methodOptions = Array.isArray(paymentMethodOptions) && paymentMethodOptions.length > 0
    ? paymentMethodOptions
    : ['Cash', 'Transfer', 'QRIS', 'Card'];
  const normalizedMethod = String(paymentMethod || '').trim().toLowerCase();
  const paymentFlowBadge = normalizedMethod === 'cash'
    ? { label: 'Tunai Fisik', tone: 'cash' }
    : { label: 'Masuk Rekening', tone: 'noncash' };

  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.summaryPanel}>
          <View style={styles.row}>
            <Text style={styles.label}>Sub Total</Text>
            <Text style={styles.value}>{toMoney(subtotal)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Diskon</Text>
            <View style={styles.discountRow}>
              <TextInput
                value={discountPercent}
                onChangeText={onChangeDiscountPercent}
                keyboardType="numeric"
                placeholder="0"
                style={[styles.input, styles.percentInput]}
              />
              <Text style={styles.percentText}>%</Text>
              <TextInput
                value={discountAmount}
                onChangeText={onChangeDiscountAmount}
                keyboardType="numeric"
                placeholder="0"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Total Harga</Text>
            <Text style={styles.value}>{toMoney(grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.payPanel}>
          <View style={styles.row}>
            <Text style={styles.label}>Metode Bayar</Text>
            <View style={styles.paymentMethodField}>
              <Pressable style={[styles.input, styles.selectInput]} onPress={() => setIsPaymentMethodModalOpen(true)}>
                <Text style={styles.selectText}>{paymentMethod || 'Pilih metode bayar'}</Text>
              </Pressable>
              <View style={styles.methodQuickRow}>
                {methodOptions.map((option) => {
                  const active = String(option) === String(paymentMethod || '');
                  return (
                    <Pressable
                      key={`quick-${String(option)}`}
                      style={[styles.methodQuickChip, active ? styles.methodQuickChipActive : null]}
                      onPress={() => onChangePaymentMethod?.(String(option))}
                    >
                      <Text style={[styles.methodQuickChipText, active ? styles.methodQuickChipTextActive : null]}>
                        {String(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.paymentFlowBadgeRow}>
                <View
                  style={[
                    styles.paymentFlowBadge,
                    paymentFlowBadge.tone === 'cash'
                      ? styles.paymentFlowBadgeCash
                      : styles.paymentFlowBadgeNonCash,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentFlowBadgeText,
                      paymentFlowBadge.tone === 'cash'
                        ? styles.paymentFlowBadgeTextCash
                        : styles.paymentFlowBadgeTextNonCash,
                    ]}
                  >
                    {paymentFlowBadge.label}
                  </Text>
                </View>
              </View>
              {paymentMethodHelperText ? (
                <Text style={styles.paymentMethodHelperText}>{paymentMethodHelperText}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{paymentStatus}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Nominal Bayar</Text>
            <TextInput
              value={paymentAmount}
              onChangeText={onChangePaymentAmount}
              keyboardType="numeric"
              placeholder="0"
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Kembalian</Text>
            <Text style={styles.value}>{toMoney(changeAmount)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Catatan</Text>
            <TextInput
              value={paymentNotes}
              onChangeText={onChangePaymentNotes}
              placeholder="Catatan pembayaran"
              multiline
              style={[styles.input, styles.notesInput]}
            />
          </View>
        </View>
      </View>

      <View style={styles.bottomActions}>
        <Pressable onPress={onSaveTransaction} style={[styles.button, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
          <Text style={styles.buttonText}>{isSubmitting ? 'Memproses...' : 'Simpan Draft'}</Text>
        </Pressable>
        <Pressable onPress={onPreviewReceipt} style={[styles.button, styles.secondaryActionButton, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
          <Text style={[styles.buttonText, styles.secondaryActionButtonText]}>Preview Nota</Text>
        </Pressable>
        <Pressable onPress={onProcessOrder} style={[styles.button, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
          <Text style={styles.buttonText}>Proses Orderan</Text>
        </Pressable>
        <Pressable onPress={onCancelTransaction} style={[styles.button, styles.cancelButton, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
          <Text style={styles.buttonText}>Batal Transaksi</Text>
        </Pressable>
      </View>

      <Modal
        visible={isPaymentMethodModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPaymentMethodModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Metode Bayar</Text>
            <ScrollView style={styles.modalList}>
              {methodOptions.map((option) => {
                const active = String(option) === String(paymentMethod || '');
                return (
                  <Pressable
                    key={String(option)}
                    style={[styles.modalItem, active ? styles.modalItemActive : null]}
                    onPress={() => {
                      onChangePaymentMethod?.(String(option));
                      setIsPaymentMethodModalOpen(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{String(option)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsPaymentMethodModalOpen(false)}>
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  summaryPanel: {
    flex: 1.25,
    minWidth: 420,
    borderWidth: 1,
    borderColor: '#aaaaaa',
    backgroundColor: 'rgba(255,255,255,0.22)',
    padding: 10,
    gap: 7,
  },
  payPanel: {
    flex: 1,
    minWidth: 360,
    gap: 7,
  },
  paymentMethodField: {
    flex: 1,
    minWidth: 170,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: '#2f2f2f',
    fontSize: 12,
    width: 110,
  },
  value: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#f7f5eb',
    fontSize: 12,
    minWidth: 170,
    paddingVertical: 5,
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#f7f5eb',
    minWidth: 170,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 12,
    textAlign: 'right',
  },
  selectInput: {
    justifyContent: 'center',
    textAlign: 'left',
  },
  selectText: {
    fontSize: 12,
    color: '#1f1f1f',
    textAlign: 'left',
  },
  methodQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  methodQuickChip: {
    borderWidth: 1,
    borderColor: '#b7b7b7',
    backgroundColor: '#f7f5eb',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  methodQuickChipActive: {
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
  },
  methodQuickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2b3448',
  },
  methodQuickChipTextActive: {
    color: '#ffffff',
  },
  paymentFlowBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paymentFlowBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  paymentFlowBadgeCash: {
    borderColor: '#9ed1b1',
    backgroundColor: '#ebf8f0',
  },
  paymentFlowBadgeNonCash: {
    borderColor: '#a8c6f0',
    backgroundColor: '#eef4ff',
  },
  paymentFlowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  paymentFlowBadgeTextCash: {
    color: '#1d6a3c',
  },
  paymentFlowBadgeTextNonCash: {
    color: '#1e4f99',
  },
  paymentMethodHelperText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#43506a',
  },
  notesInput: {
    minHeight: 60,
    textAlign: 'left',
    textAlignVertical: 'top',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentInput: {
    minWidth: 65,
    width: 65,
    textAlign: 'center',
  },
  percentText: {
    fontSize: 12,
    color: '#333333',
    width: 14,
    textAlign: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#2250c9',
    backgroundColor: '#2f64ef',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelButton: {
    borderColor: '#982222',
    backgroundColor: '#c53333',
  },
  secondaryActionButton: {
    borderColor: '#8eaee8',
    backgroundColor: '#eef3ff',
  },
  secondaryActionButtonText: {
    color: '#1f4e9b',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#a9a9a9',
    backgroundColor: '#e3e3e3',
    padding: 12,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11469f',
    marginBottom: 8,
  },
  modalList: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: '#bdbdbd',
    backgroundColor: '#ffffff',
  },
  modalItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  modalItemActive: {
    backgroundColor: '#e4ecff',
  },
  modalItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#9f9f9f',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2a2a2a',
  },
});

export default PaymentSummary;
