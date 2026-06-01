import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const CALENDAR_DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const padDatePart = (value) => String(value).padStart(2, '0');
const startOfLocalDay = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
const startOfLocalMonth = (value = new Date()) => {
  const date = startOfLocalDay(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};
const addLocalDays = (value, days = 0) => {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
};
const addLocalMonths = (value, months = 0) => {
  const date = startOfLocalMonth(value);
  return new Date(date.getFullYear(), date.getMonth() + Number(months || 0), 1);
};
const toIsoDate = (value) => {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};
const parseIsoDate = (value) => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }
  const [year, month, day] = text.split('-').map((part) => Number(part));
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};
const formatCalendarMonthLabel = (value) => startOfLocalMonth(value).toLocaleDateString('id-ID', {
  month: 'long',
  year: 'numeric',
});
const formatSelectedDateLabel = (value) => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return 'Pilih tanggal';
  }
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};
const buildCalendarCells = (cursorDate) => {
  const monthStart = startOfLocalMonth(cursorDate);
  const nativeWeekday = monthStart.getDay();
  const mondayOffset = nativeWeekday === 0 ? 6 : nativeWeekday - 1;
  const gridStart = addLocalDays(monthStart, -mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = addLocalDays(gridStart, index);
    return {
      key: toIsoDate(date),
      iso: toIsoDate(date),
      label: String(date.getDate()),
      inCurrentMonth: date.getMonth() === monthStart.getMonth(),
    };
  });
};

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
  disabledPaymentMethodOptions = [],
  paymentStatus,
  paymentAmount,
  onChangePaymentAmount,
  paymentAmountEditable = true,
  changeAmount,
  paymentNotes,
  onChangePaymentNotes,
  receivableDueDate,
  onChangeReceivableDueDate,
  showReceivableDueDate = false,
  receivableDueDateRequired = false,
  onSaveTransaction,
  saveActionVisible = true,
  saveActionLabel = 'Simpan Draft',
  onPreviewReceipt,
  onProcessOrder,
  onCancelTransaction,
  cancelActionLabel = 'Batal Transaksi',
  isSubmitting,
  deferPaymentMethodSelection = false,
}) => {
  const toMoney = (value) => `Rp. ${Number(value || 0).toLocaleString('id-ID')}`;
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isReceivableDueDateModalOpen, setIsReceivableDueDateModalOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => startOfLocalMonth(parseIsoDate(receivableDueDate) || new Date()));
  const calendarCells = useMemo(() => buildCalendarCells(calendarCursor), [calendarCursor]);
  const discountInputFocusedRef = useRef(false);
  const [discountInputDisplay, setDiscountInputDisplay] = useState(discountAmount || '');
  const methodOptions = Array.isArray(paymentMethodOptions) && paymentMethodOptions.length > 0
    ? paymentMethodOptions
    : ['Cash', 'Transfer', 'QRIS', 'Card'];
  const disabledOptions = Array.isArray(disabledPaymentMethodOptions)
    ? disabledPaymentMethodOptions.map((value) => String(value))
    : [];
  const normalizedMethod = String(paymentMethod || '').trim().toLowerCase();
  const paymentFlowBadge = !normalizedMethod
    ? { label: 'Pilih Saat Proses', tone: 'noncash' }
    : normalizedMethod === 'cash'
      ? { label: 'Tunai Fisik', tone: 'cash' }
      : normalizedMethod === 'saldo pelanggan'
        ? { label: 'Settlement Saldo', tone: 'wallet' }
        : { label: 'Masuk Rekening', tone: 'noncash' };

  const deriveDiscountRawInput = (value) => {
    const cleaned = String(value || '').replace(/[^0-9.,]/g, '').trim();
    const normalized = cleaned.replace(/\./g, '');
    if (!normalized || /^0+(,0{0,2})?$/.test(normalized)) {
      return '';
    }
    return normalized.replace(/,00$/, '');
  };

  const formatIntegerWithDotSeparator = (value) => {
    const digits = String(value || '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '') || '0';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatDiscountEditingDisplay = (value) => {
    const text = String(value || '').replace(/[^0-9.,]/g, '').trim();
    if (!text) {
      return '';
    }

    const lastCommaIndex = text.lastIndexOf(',');
    const lastDotIndex = text.lastIndexOf('.');
    const separatorIndex = Math.max(lastCommaIndex, lastDotIndex);
    if (separatorIndex < 0) {
      return `Rp ${formatIntegerWithDotSeparator(text)}`;
    }

    const fractionalRaw = text.slice(separatorIndex + 1);
    const fractionalDigits = fractionalRaw.replace(/[^0-9]/g, '');
    const hasExplicitDecimal = text.endsWith(',') || text.endsWith('.') || fractionalDigits.length <= 2;
    if (!hasExplicitDecimal) {
      return `Rp ${formatIntegerWithDotSeparator(text)}`;
    }

    const integerDigits = text.slice(0, separatorIndex).replace(/[^0-9]/g, '') || '0';
    return `Rp ${formatIntegerWithDotSeparator(integerDigits)},${fractionalDigits.slice(0, 2)}`;
  };

  useEffect(() => {
    if (!discountInputFocusedRef.current) {
      setDiscountInputDisplay(discountAmount || '');
    }
  }, [discountAmount]);

  useEffect(() => {
    if (isReceivableDueDateModalOpen) {
      setCalendarCursor(startOfLocalMonth(parseIsoDate(receivableDueDate) || new Date()));
    }
  }, [isReceivableDueDateModalOpen, receivableDueDate]);

  const handleDiscountChangeText = (value) => {
    const nextDisplay = formatDiscountEditingDisplay(value);
    setDiscountInputDisplay(nextDisplay);
    onChangeDiscountAmount?.(deriveDiscountRawInput(nextDisplay) || '0');
  };

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
                value={discountInputDisplay}
                onFocus={() => {
                  discountInputFocusedRef.current = true;
                  setDiscountInputDisplay(formatDiscountEditingDisplay(deriveDiscountRawInput(discountAmount)));
                }}
                onBlur={() => {
                  discountInputFocusedRef.current = false;
                  setDiscountInputDisplay(discountAmount || '');
                }}
                onChangeText={handleDiscountChangeText}
                keyboardType="decimal-pad"
                placeholder="0"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Total Harga</Text>
            <Text style={styles.value}>{toMoney(grandTotal)}</Text>
          </View>

          <View style={styles.previewDock}>
            <Pressable
              onPress={onPreviewReceipt}
              style={[styles.previewButton, isSubmitting ? styles.buttonDisabled : null]}
              disabled={isSubmitting}
            >
              <Text style={styles.previewButtonText}>Preview Nota</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.payPanel}>
          <View style={styles.row}>
            <Text style={styles.label}>Metode Bayar</Text>
            <View style={styles.paymentMethodField}>
              {deferPaymentMethodSelection ? (
                <View style={[styles.input, styles.selectInput, styles.readonlySelectInput]}>
                  <Text style={styles.selectText}>
                    {paymentMethod || 'Pilih saat klik Proses Order'}
                  </Text>
                </View>
              ) : (
                <>
                  <Pressable style={[styles.input, styles.selectInput]} onPress={() => setIsPaymentMethodModalOpen(true)}>
                    <Text style={styles.selectText}>{paymentMethod || 'Pilih metode bayar'}</Text>
                  </Pressable>
                  <View style={styles.methodQuickRow}>
                    {methodOptions.map((option) => {
                      const active = String(option) === String(paymentMethod || '');
                      const disabled = disabledOptions.includes(String(option));
                      return (
                        <Pressable
                          key={`quick-${String(option)}`}
                          style={[
                            styles.methodQuickChip,
                            active ? styles.methodQuickChipActive : null,
                            disabled ? styles.methodQuickChipDisabled : null,
                          ]}
                          disabled={disabled}
                          onPress={() => onChangePaymentMethod?.(String(option))}
                        >
                          <Text
                            style={[
                              styles.methodQuickChipText,
                              active ? styles.methodQuickChipTextActive : null,
                              disabled ? styles.methodQuickChipTextDisabled : null,
                            ]}
                          >
                            {String(option)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <View style={styles.paymentFlowBadgeRow}>
                <View
                  style={[
                    styles.paymentFlowBadge,
                    paymentFlowBadge.tone === 'cash'
                      ? styles.paymentFlowBadgeCash
                      : paymentFlowBadge.tone === 'wallet'
                        ? styles.paymentFlowBadgeWallet
                      : styles.paymentFlowBadgeNonCash,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentFlowBadgeText,
                      paymentFlowBadge.tone === 'cash'
                        ? styles.paymentFlowBadgeTextCash
                        : paymentFlowBadge.tone === 'wallet'
                          ? styles.paymentFlowBadgeTextWallet
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

          {showReceivableDueDate ? (
            <View style={styles.row}>
              <Text style={styles.label}>Tempo Piutang</Text>
              <View style={styles.receivableDueField}>
                <Pressable
                  onPress={() => setIsReceivableDueDateModalOpen(true)}
                  style={[
                    styles.input,
                    styles.receivableDueInput,
                    receivableDueDateRequired && !String(receivableDueDate || '').trim()
                      ? styles.inputRequired
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.receivableDueInputText,
                      !receivableDueDate ? styles.receivableDueInputPlaceholder : null,
                    ]}
                  >
                    {formatSelectedDateLabel(receivableDueDate)}
                  </Text>
                </Pressable>
                <Text style={styles.receivableDueHelper}>
                  {receivableDueDateRequired
                    ? 'Wajib diisi untuk piutang/DP.'
                    : 'Tanggal janji bayar customer.'}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.label}>Nominal Bayar</Text>
            <TextInput
              value={paymentAmount}
              onChangeText={onChangePaymentAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              style={[styles.input, !paymentAmountEditable ? styles.inputReadonly : null]}
              editable={paymentAmountEditable}
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
        {saveActionVisible ? (
          <Pressable onPress={onSaveTransaction} style={[styles.button, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
            <Text style={styles.buttonText}>{isSubmitting ? 'Memproses...' : saveActionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onProcessOrder} style={[styles.button, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
          <Text style={styles.buttonText}>Proses Orderan</Text>
        </Pressable>
        <Pressable onPress={onCancelTransaction} style={[styles.button, styles.cancelButton, isSubmitting ? styles.buttonDisabled : null]} disabled={isSubmitting}>
          <Text style={styles.buttonText}>{cancelActionLabel}</Text>
        </Pressable>
      </View>

      <Modal
        visible={isReceivableDueDateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReceivableDueDateModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarModalCard}>
            <Text style={styles.modalTitle}>Pilih Tempo Piutang</Text>
            <Text style={styles.calendarSelectedText}>
              {receivableDueDate
                ? `Tanggal dipilih: ${formatSelectedDateLabel(receivableDueDate)}`
                : 'Pilih tanggal janji bayar customer.'}
            </Text>
            <View style={styles.calendarNavRow}>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setCalendarCursor((prev) => addLocalMonths(prev, -1))}
              >
                <Text style={styles.calendarNavButtonText}>{'<'}</Text>
              </Pressable>
              <Text style={styles.calendarMonthLabel}>{formatCalendarMonthLabel(calendarCursor)}</Text>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setCalendarCursor((prev) => addLocalMonths(prev, 1))}
              >
                <Text style={styles.calendarNavButtonText}>{'>'}</Text>
              </Pressable>
            </View>
            <View style={styles.calendarDayHeaderRow}>
              {CALENDAR_DAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarDayHeaderText}>{label}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                const selected = cell.iso === String(receivableDueDate || '').trim();
                return (
                  <Pressable
                    key={cell.key}
                    style={[
                      styles.calendarDayCell,
                      !cell.inCurrentMonth ? styles.calendarDayCellMuted : null,
                      selected ? styles.calendarDayCellSelected : null,
                    ]}
                    onPress={() => {
                      onChangeReceivableDueDate?.(cell.iso);
                      setIsReceivableDueDateModalOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.calendarDayCellText,
                        !cell.inCurrentMonth ? styles.calendarDayCellTextMuted : null,
                        selected ? styles.calendarDayCellTextSelected : null,
                      ]}
                    >
                      {cell.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setIsReceivableDueDateModalOpen(false)}>
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
                const disabled = disabledOptions.includes(String(option));
                return (
                  <Pressable
                    key={String(option)}
                    style={[
                      styles.modalItem,
                      active ? styles.modalItemActive : null,
                      disabled ? styles.modalItemDisabled : null,
                    ]}
                    disabled={disabled}
                    onPress={() => {
                      onChangePaymentMethod?.(String(option));
                      setIsPaymentMethodModalOpen(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, disabled ? styles.modalItemTextDisabled : null]}>
                      {String(option)}
                    </Text>
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
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    gap: 8,
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
    color: '#435674',
    fontSize: 12,
    width: 110,
    fontWeight: '800',
  },
  value: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#fbfdff',
    borderRadius: 8,
    fontSize: 12,
    minWidth: 170,
    paddingVertical: 7,
    paddingHorizontal: 10,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4dcea',
    backgroundColor: '#fbfdff',
    borderRadius: 8,
    minWidth: 170,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: 12,
    textAlign: 'right',
  },
  selectInput: {
    justifyContent: 'center',
    textAlign: 'left',
  },
  readonlySelectInput: {
    opacity: 0.85,
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
    borderColor: '#d4dcea',
    backgroundColor: '#f7f9fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  methodQuickChipActive: {
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
  },
  methodQuickChipDisabled: {
    borderColor: '#ccd3e1',
    backgroundColor: '#eef1f6',
  },
  methodQuickChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2b3448',
  },
  methodQuickChipTextActive: {
    color: '#ffffff',
  },
  methodQuickChipTextDisabled: {
    color: '#7a8599',
  },
  paymentFlowBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paymentFlowBadge: {
    borderWidth: 1,
    borderRadius: 999,
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
  paymentFlowBadgeWallet: {
    borderColor: '#b8dfc7',
    backgroundColor: '#f3fbf6',
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
  paymentFlowBadgeTextWallet: {
    color: '#1d6a3c',
  },
  paymentMethodHelperText: {
    fontSize: 10,
    lineHeight: 15,
    color: '#43506a',
  },
  inputReadonly: {
    backgroundColor: '#eef1f6',
    color: '#5a6578',
  },
  inputRequired: {
    borderColor: '#d33a2c',
    backgroundColor: '#fff7f6',
  },
  receivableDueField: {
    flex: 1,
    minWidth: 170,
    gap: 4,
  },
  receivableDueInput: {
    width: '100%',
    justifyContent: 'center',
  },
  receivableDueInputText: {
    color: '#14233d',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  receivableDueInputPlaceholder: {
    color: '#718096',
  },
  receivableDueHelper: {
    color: '#8a4b00',
    fontSize: 10,
    fontWeight: '700',
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
  previewDock: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  previewButton: {
    borderWidth: 1,
    borderColor: '#9aa9c1',
    backgroundColor: '#f7f9fd',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  previewButtonText: {
    color: '#1d355d',
    fontSize: 12,
    fontWeight: '800',
  },
  button: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#0755b8',
    backgroundColor: '#0755b8',
    borderRadius: 8,
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
  buttonDisabled: {
    opacity: 0.65,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 35, 72, 0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
  },
  calendarModalCard: {
    width: '100%',
    maxWidth: 430,
    borderWidth: 1,
    borderColor: '#c8d8f2',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#11469f',
    marginBottom: 8,
  },
  calendarSelectedText: {
    color: '#435674',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavButton: {
    borderWidth: 1,
    borderColor: '#b9c8e1',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavButtonText: {
    color: '#174a8c',
    fontSize: 16,
    fontWeight: '900',
  },
  calendarMonthLabel: {
    color: '#13294b',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  calendarDayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  calendarDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: '#5c6b83',
    fontSize: 10,
    fontWeight: '900',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: '#dce5f4',
    borderRadius: 10,
    overflow: 'hidden',
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#edf1f7',
  },
  calendarDayCellMuted: {
    backgroundColor: '#f6f8fc',
  },
  calendarDayCellSelected: {
    backgroundColor: '#0755b8',
  },
  calendarDayCellText: {
    color: '#1f2d46',
    fontSize: 12,
    fontWeight: '800',
  },
  calendarDayCellTextMuted: {
    color: '#9aa5b5',
  },
  calendarDayCellTextSelected: {
    color: '#ffffff',
  },
  modalList: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: '#dce5f4',
    backgroundColor: '#ffffff',
    borderRadius: 10,
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
  modalItemDisabled: {
    backgroundColor: '#f3f4f6',
  },
  modalItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  modalItemTextDisabled: {
    color: '#8a94a6',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#b9c8e1',
    backgroundColor: '#f5f9ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#174a8c',
  },
});

export default PaymentSummary;
