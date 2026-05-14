import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { formatRupiah } from '../../utils/currency';

const DEFAULT_WIZARD_STEP_ITEMS = [
  {
    code: 'book_type',
    title: 'Pilih Jenis Buku',
    shortLabel: 'Jenis',
    description: 'Tentukan dulu jenis produk buku agar aturan berikutnya dibentuk sesuai kebutuhan customer.',
  },
  {
    code: 'finished_size',
    title: 'Pilih Ukuran Jadi',
    shortLabel: 'Ukuran',
    description: 'Ukuran jadi menentukan kelipatan halaman dan arah produksi buku.',
  },
  {
    code: 'print_model',
    title: 'Pilih Model Cetak',
    shortLabel: 'Model',
    description: 'Kasir memilih apakah buku dicetak normal per halaman atau susun buku / lipat buku.',
  },
  {
    code: 'print_side',
    title: 'Pilih Sisi Cetak',
    shortLabel: 'Sisi',
    description: 'Pilih 1 sisi atau bolak-balik sesuai kebutuhan customer dan aturan layout.',
  },
  {
    code: 'customer_page_count',
    title: 'Isi Halaman Customer',
    shortLabel: 'Halaman',
    description: 'Masukkan jumlah halaman file customer sebelum sistem membulatkan ke kebutuhan produksi.',
  },
  {
    code: 'material_inside',
    title: 'Pilih Bahan Isi',
    shortLabel: 'Isi',
    description: 'Bahan isi dipakai untuk halaman dalam buku dan memengaruhi kalkulasi produksi.',
  },
  {
    code: 'material_cover',
    title: 'Pilih Bahan Cover',
    shortLabel: 'Cover',
    description: 'Bahan cover dipakai untuk sampul buku dan dihitung terpisah dari isi.',
  },
  {
    code: 'print_colors',
    title: 'Tentukan Mode Cetak',
    shortLabel: 'Cetak',
    description: 'Pilih mode cetak isi dan cover agar preview produksi sesuai kebutuhan customer.',
  },
  {
    code: 'finishing',
    title: 'Pilih Finishing',
    shortLabel: 'Finishing',
    description: 'Pilih finishing utama dan tambahan sebagai penutup konfigurasi Buku.',
  },
];

const renderBookOptionButtons = (styles, rows, selectedValue, onChange) => {
  const options = Array.isArray(rows) ? rows : [];
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.bookOptionWrap}>
      {options.map((row) => {
        const value = String(row?.value || '').trim();
        const label = String(row?.label || row?.value || '').trim() || value;
        const isActive = value && value === selectedValue;

        return (
          <Pressable
            key={`${label}-${value}`}
            style={[styles.bookOptionChip, isActive ? styles.bookOptionChipActive : null]}
            onPress={() => onChange?.(value)}
          >
            <View style={styles.bookOptionChipBody}>
              <Text style={[styles.bookOptionChipText, isActive ? styles.bookOptionChipTextActive : null]}>
                {label}
              </Text>
              {Number(row?.selling_price || row?.unit_price || 0) > 0 ? (
                <Text style={[styles.bookOptionChipPrice, isActive ? styles.bookOptionChipTextActive : null]}>
                  {formatRupiah(Number(row?.selling_price || row?.unit_price || 0))}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const renderBookMultiOptionButtons = (styles, rows, selectedValues, onToggle) => {
  const options = Array.isArray(rows) ? rows : [];
  const activeValues = new Set(
    (Array.isArray(selectedValues) ? selectedValues : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  );
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.bookOptionWrap}>
      {options.map((row) => {
        const value = String(row?.value || '').trim();
        const label = String(row?.label || row?.value || '').trim() || value;
        const isActive = value && activeValues.has(value);

        return (
          <Pressable
            key={`${label}-${value}`}
            style={[styles.bookOptionChip, isActive ? styles.bookOptionChipActive : null]}
            onPress={() => onToggle?.(value)}
          >
            <View style={styles.bookOptionChipBody}>
              <Text style={[styles.bookOptionChipText, isActive ? styles.bookOptionChipTextActive : null]}>
                {label}
              </Text>
              {Number(row?.selling_price || row?.unit_price || 0) > 0 ? (
                <Text style={[styles.bookOptionChipPrice, isActive ? styles.bookOptionChipTextActive : null]}>
                  {formatRupiah(Number(row?.selling_price || row?.unit_price || 0))}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const findOptionLabel = (rows, selectedValue, fallback = '-') => {
  const active = (Array.isArray(rows) ? rows : []).find((row) => String(row?.value || '').trim() === String(selectedValue || '').trim());
  return String(active?.label || selectedValue || fallback).trim() || fallback;
};

const BookRulePanel = ({
  styles,
  bookProductLabel,
  bookType,
  bookTypeOptions,
  bookWizardSteps,
  onChangeBookType,
  bookSegment,
  bookCashierNote,
  bookFinishedSize,
  bookFinishedSizeOptions,
  onChangeBookFinishedSize,
  bookMaterialInsideProductId,
  bookMaterialInsideOptions,
  onChangeBookMaterialInside,
  bookMaterialCoverProductId,
  bookMaterialCoverOptions,
  onChangeBookMaterialCover,
  bookPrintModel,
  bookPrintModelOptions,
  onChangeBookPrintModel,
  bookPrintSide,
  bookPrintSideOptions,
  onChangeBookPrintSide,
  bookInsidePrint,
  bookInsidePrintOptions,
  onChangeBookInsidePrint,
  bookCoverPrint,
  bookCoverPrintOptions,
  onChangeBookCoverPrint,
  bookBindingType,
  bookBindingTypeOptions,
  onChangeBookBindingType,
  bookExtraFinishingValues,
  bookExtraFinishingOptions,
  onToggleBookExtraFinishing,
  bookPrintRulePreview,
  bookPageValidation,
  pages,
  onChangePages,
  bookPrintRulePrompt,
}) => {
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const wizardSteps = useMemo(() => (
    Array.isArray(bookWizardSteps) && bookWizardSteps.length > 0
      ? bookWizardSteps
      : DEFAULT_WIZARD_STEP_ITEMS
  ), [bookWizardSteps]);
  const totalWizardSteps = wizardSteps.length || DEFAULT_WIZARD_STEP_ITEMS.length;
  const currentStepMeta = useMemo(
    () => wizardSteps[Math.max(0, Math.min(wizardStep - 1, wizardSteps.length - 1))] || DEFAULT_WIZARD_STEP_ITEMS[0],
    [wizardStep, wizardSteps],
  );
  const currentStepCode = String(currentStepMeta?.code || '').trim();
  const hasBookType = String(bookType || '').trim() !== '';
  const hasFinishedSize = String(bookFinishedSize || '').trim() !== '';
  const hasPrintModel = String(bookPrintModel || '').trim() !== '';
  const hasPrintSide = String(bookPrintSide || '').trim() !== '';
  const hasPages = Math.max(Math.floor(Number(pages) || 0), 0) > 0;
  const hasInsideMaterial = Array.isArray(bookMaterialInsideOptions) && bookMaterialInsideOptions.length > 0
    ? String(bookMaterialInsideProductId || '').trim() !== ''
    : true;
  const hasCoverMaterial = Array.isArray(bookMaterialCoverOptions) && bookMaterialCoverOptions.length > 0
    ? String(bookMaterialCoverProductId || '').trim() !== ''
    : true;
  const hasInsidePrint = Array.isArray(bookInsidePrintOptions) && bookInsidePrintOptions.length > 0
    ? String(bookInsidePrint || '').trim() !== ''
    : true;
  const hasCoverPrint = Array.isArray(bookCoverPrintOptions) && bookCoverPrintOptions.length > 0
    ? String(bookCoverPrint || '').trim() !== ''
    : true;
  const hasBindingType = Array.isArray(bookBindingTypeOptions) && bookBindingTypeOptions.length > 0
    ? String(bookBindingType || '').trim() !== ''
    : true;
  const canGoNext = useMemo(() => {
    switch (currentStepCode) {
      case 'book_type':
        return hasBookType;
      case 'finished_size':
        return hasFinishedSize;
      case 'print_model':
        return hasPrintModel;
      case 'print_side':
        return hasPrintSide;
      case 'customer_page_count':
        return hasPages;
      case 'material_inside':
        return hasInsideMaterial;
      case 'material_cover':
        return hasCoverMaterial;
      case 'print_colors':
        return hasInsidePrint && hasCoverPrint;
      case 'finishing':
        return hasBindingType;
      default:
        return true;
    }
  }, [
    currentStepCode,
    hasBindingType,
    hasBookType,
    hasCoverMaterial,
    hasCoverPrint,
    hasFinishedSize,
    hasInsideMaterial,
    hasInsidePrint,
    hasPages,
    hasPrintModel,
    hasPrintSide,
  ]);
  const typeLabel = useMemo(
    () => findOptionLabel(bookTypeOptions, bookType, 'Belum dipilih'),
    [bookTypeOptions, bookType],
  );
  const sizeLabel = useMemo(
    () => String(bookFinishedSize || '').trim() || 'Belum dipilih',
    [bookFinishedSize],
  );
  const printModelLabel = useMemo(
    () => findOptionLabel(bookPrintModelOptions, bookPrintModel, 'Belum dipilih'),
    [bookPrintModelOptions, bookPrintModel],
  );
  const printSideLabel = useMemo(
    () => findOptionLabel(bookPrintSideOptions, bookPrintSide, 'Belum dipilih'),
    [bookPrintSideOptions, bookPrintSide],
  );
  const insideMaterialLabel = useMemo(
    () => findOptionLabel(bookMaterialInsideOptions, String(bookMaterialInsideProductId || '').trim(), 'Belum dipilih'),
    [bookMaterialInsideOptions, bookMaterialInsideProductId],
  );
  const coverMaterialLabel = useMemo(
    () => findOptionLabel(bookMaterialCoverOptions, String(bookMaterialCoverProductId || '').trim(), 'Belum dipilih'),
    [bookMaterialCoverOptions, bookMaterialCoverProductId],
  );
  const insidePrintLabel = useMemo(
    () => findOptionLabel(bookInsidePrintOptions, bookInsidePrint, 'Belum dipilih'),
    [bookInsidePrintOptions, bookInsidePrint],
  );
  const coverPrintLabel = useMemo(
    () => findOptionLabel(bookCoverPrintOptions, bookCoverPrint, 'Belum dipilih'),
    [bookCoverPrintOptions, bookCoverPrint],
  );
  const bindingLabel = useMemo(
    () => findOptionLabel(bookBindingTypeOptions, bookBindingType, 'Belum dipilih'),
    [bookBindingTypeOptions, bookBindingType],
  );
  useEffect(() => {
    if (wizardStep > totalWizardSteps) {
      setWizardStep(totalWizardSteps);
    }
  }, [wizardStep, totalWizardSteps]);

  const openConfigurator = () => {
    setWizardStep(1);
    setIsConfiguratorOpen(true);
  };

  const closeConfigurator = () => {
    setIsConfiguratorOpen(false);
  };

  const handleNextStep = () => {
    if (!canGoNext) {
      return;
    }
    setWizardStep((prev) => Math.min(prev + 1, totalWizardSteps));
  };

  const handlePreviousStep = () => {
    setWizardStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <View style={styles.bookRuleCard}>
      <Text style={styles.bookRuleTitle}>Konfigurasi Buku</Text>
      <View style={styles.bookReadOnlyRow}>
        <Text style={styles.bookReadOnlyLabel}>Produk POS</Text>
        <Text style={styles.bookReadOnlyValue}>{String(bookProductLabel || '-')}</Text>
      </View>

      <View style={styles.bookRuleResultCard}>
        <Text style={styles.bookOptionLabel}>Ringkasan Konfigurasi</Text>
        <Text style={styles.bookRuleResultLine}>Jenis Buku: {typeLabel}</Text>
        <Text style={styles.bookRuleResultLine}>Ukuran: {sizeLabel}</Text>
        <Text style={styles.bookRuleResultLine}>Model Cetak: {printModelLabel}</Text>
        <Text style={styles.bookRuleResultLine}>Sisi Cetak: {printSideLabel}</Text>
        {bookSegment ? (
          <Text style={styles.bookRuleMessage}>Segmen: {String(bookSegment)}</Text>
        ) : null}
        {bookCashierNote ? (
          <Text style={styles.bookRuleMessage}>Catatan kasir: {String(bookCashierNote)}</Text>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.primaryButton} onPress={openConfigurator}>
          <Text style={styles.primaryButtonText}>Atur Buku Bertahap</Text>
        </Pressable>
      </View>

      {bookPrintRulePreview ? (
        <View style={styles.bookRuleResultCard}>
          <Text style={styles.bookOptionLabel}>Preview Produksi Sistem</Text>
          <Text style={styles.bookRuleResultLine}>Kelipatan wajib: {bookPrintRulePreview?.required_page_multiple ?? 'Ikut layout'}</Text>
          <Text style={styles.bookRuleResultLine}>Halaman produksi: {bookPrintRulePreview?.production_page_count ?? 'Cek manual'}</Text>
          <Text style={styles.bookRuleResultLine}>Halaman kosong: {bookPrintRulePreview?.blank_page_count ?? 'Cek manual'}</Text>
          <Text style={styles.bookRuleResultLine}>Estimasi A3+: {bookPrintRulePreview?.estimated_a3_plus_sheets ?? 'Cek manual'} lembar</Text>
          {bookPrintRulePreview?.blank_page_message ? (
            <Text style={styles.bookRuleMessage}>{String(bookPrintRulePreview.blank_page_message)}</Text>
          ) : null}
          {bookPrintRulePreview?.warning ? (
            <View style={styles.bookWarningBadge}>
              <Text style={styles.bookWarningText}>{String(bookPrintRulePreview.warning)}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.bookRuleHint}>
          Buka popup konfigurasi lalu pilih jenis buku secara bertahap. Preview produksi akan muncul setelah data dasar terisi.
        </Text>
      )}

      <Modal
        visible={isConfiguratorOpen}
        transparent
        animationType="fade"
        onRequestClose={closeConfigurator}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.finishingModalCard]}>
            <Text style={styles.modalTitle}>Wizard Konfigurasi Buku</Text>
            <Text style={styles.modalSubTitle}>
              Langkah {wizardStep} dari {totalWizardSteps}. Kasir wajib mengikuti urutan aturan Buku dari awal sampai akhir.
            </Text>

            <View style={styles.bookWizardStepRow}>
              {wizardSteps.map((item, index) => {
                const stepNumber = index + 1;
                const isActive = wizardStep === stepNumber;
                const isDone = wizardStep > stepNumber;

                return (
                  <View
                    key={`wizard-step-${stepNumber}`}
                    style={styles.bookWizardStepItem}
                  >
                    <View
                      style={[
                        styles.bookWizardStepDot,
                        isActive ? styles.bookWizardStepDotActive : null,
                        isDone ? styles.bookWizardStepDotDone : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bookWizardStepDotText,
                          isActive || isDone ? styles.bookWizardStepDotTextActive : null,
                        ]}
                      >
                        {stepNumber}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.bookWizardStepLabel,
                        isActive || isDone ? styles.bookWizardStepLabelActive : null,
                      ]}
                    >
                      {String(item.shortLabel || item.short_label || item.title || stepNumber)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.bookWizardHeaderCard}>
              <Text style={styles.bookWizardHeaderTitle}>
                Langkah {wizardStep}. {String(currentStepMeta?.title || '')}
              </Text>
              <Text style={styles.bookWizardHeaderSubTitle}>
                {String(currentStepMeta?.description || '')}
              </Text>
              <View style={styles.bookWizardSummaryGrid}>
                <View style={styles.bookRuleResultCard}>
                  <Text style={styles.bookOptionLabel}>Ringkasan Sementara</Text>
                  <Text style={styles.bookRuleResultLine}>Jenis Buku: {typeLabel}</Text>
                  <Text style={styles.bookRuleResultLine}>Ukuran: {sizeLabel}</Text>
                  <Text style={styles.bookRuleResultLine}>Model Cetak: {printModelLabel}</Text>
                  <Text style={styles.bookRuleResultLine}>Sisi Cetak: {printSideLabel}</Text>
                </View>
                <View style={styles.bookRuleResultCard}>
                  <Text style={styles.bookOptionLabel}>Arah Kasir</Text>
                  <Text style={styles.bookRuleResultLine}>Segmen: {String(bookSegment || '-')}</Text>
                  <Text style={styles.bookRuleResultLine}>
                    Status Halaman: {bookPageValidation?.isManualCheck
                      ? 'Perlu cek manual'
                      : Number(bookPageValidation?.requiredMultiple || 0) > 0
                        ? `Kelipatan ${bookPageValidation?.requiredMultiple ?? '-'}`
                        : 'Belum ditentukan'}
                  </Text>
                  {bookCashierNote ? (
                    <Text style={styles.bookRuleMessage}>Catatan kasir: {String(bookCashierNote)}</Text>
                  ) : (
                    <Text style={styles.bookRuleMessage}>Catatan kasir akan tampil setelah jenis buku dipilih.</Text>
                  )}
                </View>
              </View>
            </View>

            <ScrollView style={styles.listWrap}>
              {currentStepCode === 'book_type' ? (
                <>
                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Jenis Buku')}</Text>
                    <Text style={styles.bookRuleMessage}>Pilih dulu jenis buku agar aturan berikutnya bisa dibentuk oleh sistem.</Text>
                    {renderBookOptionButtons(styles, bookTypeOptions, String(bookType || '').trim(), onChangeBookType)}
                  </View>
                  {hasBookType ? (
                    <View style={styles.bookRuleResultCard}>
                      <Text style={styles.bookOptionLabel}>Arah Produk Buku</Text>
                      {bookSegment ? (
                        <Text style={styles.bookRuleResultLine}>Segmen: {String(bookSegment)}</Text>
                      ) : null}
                      {bookCashierNote ? (
                        <Text style={styles.bookRuleMessage}>Catatan kasir: {String(bookCashierNote)}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}

              {currentStepCode === 'finished_size' ? (
                <View style={styles.bookOptionGroup}>
                  <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Ukuran Jadi')}</Text>
                  <Text style={styles.bookRuleMessage}>Pilih ukuran yang cocok untuk jenis buku yang sudah dipilih.</Text>
                  {renderBookOptionButtons(styles, bookFinishedSizeOptions, bookFinishedSize, onChangeBookFinishedSize)}
                </View>
              ) : null}

              {currentStepCode === 'print_model' ? (
                <View style={styles.bookOptionGroup}>
                  <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Model Cetak')}</Text>
                  <Text style={styles.bookRuleMessage}>Tentukan apakah buku dicetak normal atau susun buku.</Text>
                  {renderBookOptionButtons(styles, bookPrintModelOptions, bookPrintModel, onChangeBookPrintModel)}
                </View>
              ) : null}

              {currentStepCode === 'print_side' ? (
                <View style={styles.bookOptionGroup}>
                  <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Sisi Cetak')}</Text>
                  <Text style={styles.bookRuleMessage}>Pilih 1 sisi atau bolak-balik sesuai kebutuhan customer.</Text>
                  {renderBookOptionButtons(styles, bookPrintSideOptions, bookPrintSide, onChangeBookPrintSide)}
                </View>
              ) : null}

              {currentStepCode === 'customer_page_count' ? (
                <>
                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Isi Halaman Customer')}</Text>
                    <Text style={styles.bookRuleMessage}>Isi jumlah halaman file customer sebelum pembulatan produksi.</Text>
                    <TextInput
                      value={String(pages || '')}
                      onChangeText={onChangePages}
                      placeholder="1"
                      keyboardType="numeric"
                      style={[styles.input, styles.alignCenter]}
                    />
                  </View>
                  <View style={styles.bookRuleResultCard}>
                    <Text style={styles.bookOptionLabel}>Validasi Halaman</Text>
                    {Number(bookPageValidation?.inputPages || 0) < 1 ? (
                      <Text style={styles.bookRuleMessage}>Isi jumlah halaman customer untuk melihat aturan kelipatan.</Text>
                    ) : bookPageValidation?.isManualCheck ? (
                      <Text style={styles.bookRuleMessage}>
                        {String(bookPrintRulePrompt || 'Kombinasi ukuran atau model cetak saat ini perlu dicek manual oleh kasir/produksi.')}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.bookRuleResultLine}>Halaman input: {bookPageValidation?.inputPages ?? 0}</Text>
                        <Text style={styles.bookRuleResultLine}>Kelipatan wajib: {bookPageValidation?.requiredMultiple ?? '-'}</Text>
                        <Text style={styles.bookRuleResultLine}>Halaman kosong tambahan: {bookPageValidation?.blankPages ?? 0}</Text>
                        <Text style={styles.bookRuleResultLine}>Total halaman cetak: {bookPageValidation?.totalPrintPages ?? 0}</Text>
                        {!bookPageValidation?.isExact ? (
                          <Text style={styles.bookRuleMessage}>
                            Jumlah halaman belum pas kelipatan. Sistem akan menambahkan halaman kosong untuk produksi.
                          </Text>
                        ) : (
                          <Text style={styles.bookRuleMessage}>Jumlah halaman sudah sesuai kelipatan produksi.</Text>
                        )}
                      </>
                    )}
                  </View>
                </>
              ) : null}

              {currentStepCode === 'material_inside' ? (
                <>
                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Bahan Isi')}</Text>
                    <Text style={styles.bookRuleMessage}>Pilih bahan isi yang dipakai untuk halaman dalam buku.</Text>
                    {Array.isArray(bookMaterialInsideOptions) && bookMaterialInsideOptions.length > 0 ? (
                      renderBookOptionButtons(
                        styles,
                        bookMaterialInsideOptions,
                        String(bookMaterialInsideProductId || '').trim(),
                        onChangeBookMaterialInside,
                      )
                    ) : (
                      <Text style={styles.bookRuleHint}>Material isi belum tersedia di katalog backend.</Text>
                    )}
                  </View>
                  <View style={styles.bookRuleResultCard}>
                    <Text style={styles.bookOptionLabel}>Pilihan Saat Ini</Text>
                    <Text style={styles.bookRuleResultLine}>Bahan Isi: {insideMaterialLabel}</Text>
                  </View>
                </>
              ) : null}

              {currentStepCode === 'material_cover' ? (
                <>
                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Bahan Cover')}</Text>
                    <Text style={styles.bookRuleMessage}>Pilih bahan cover untuk sampul buku.</Text>
                    {Array.isArray(bookMaterialCoverOptions) && bookMaterialCoverOptions.length > 0 ? (
                      renderBookOptionButtons(
                        styles,
                        bookMaterialCoverOptions,
                        String(bookMaterialCoverProductId || '').trim(),
                        onChangeBookMaterialCover,
                      )
                    ) : (
                      <Text style={styles.bookRuleHint}>Material cover belum tersedia di katalog backend.</Text>
                    )}
                  </View>
                  <View style={styles.bookRuleResultCard}>
                    <Text style={styles.bookOptionLabel}>Pilihan Saat Ini</Text>
                    <Text style={styles.bookRuleResultLine}>Bahan Isi: {insideMaterialLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Bahan Cover: {coverMaterialLabel}</Text>
                  </View>
                </>
              ) : null}

              {currentStepCode === 'print_colors' ? (
                <>
                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Tentukan Mode Cetak')}</Text>
                    <Text style={styles.bookRuleMessage}>Pilih hitam putih atau full color untuk isi buku.</Text>
                    {renderBookOptionButtons(styles, bookInsidePrintOptions, bookInsidePrint, onChangeBookInsidePrint)}
                  </View>

                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Mode Cetak Cover</Text>
                    <Text style={styles.bookRuleMessage}>Pilih mode cetak untuk sampul buku.</Text>
                    {renderBookOptionButtons(styles, bookCoverPrintOptions, bookCoverPrint, onChangeBookCoverPrint)}
                  </View>

                  <View style={styles.bookRuleResultCard}>
                    <Text style={styles.bookOptionLabel}>Pilihan Saat Ini</Text>
                    <Text style={styles.bookRuleResultLine}>Cetak Isi: {insidePrintLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Cetak Cover: {coverPrintLabel}</Text>
                  </View>
                </>
              ) : null}

              {currentStepCode === 'finishing' ? (
                <>
                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Langkah {wizardStep}. {String(currentStepMeta?.title || 'Pilih Finishing')}</Text>
                    <Text style={styles.bookRuleMessage}>Tentukan jenis jilid atau finishing utama buku.</Text>
                    {renderBookOptionButtons(styles, bookBindingTypeOptions, bookBindingType, onChangeBookBindingType)}
                  </View>

                  <View style={styles.bookOptionGroup}>
                    <Text style={styles.bookOptionLabel}>Finishing Tambahan</Text>
                    <Text style={styles.bookRuleMessage}>Tambahkan opsi tambahan jika memang dibutuhkan customer.</Text>
                    {renderBookMultiOptionButtons(
                      styles,
                      bookExtraFinishingOptions,
                      bookExtraFinishingValues,
                      onToggleBookExtraFinishing,
                    )}
                  </View>

                  <View style={styles.bookRuleResultCard}>
                    <Text style={styles.bookOptionLabel}>Ringkasan Pilihan Kasir</Text>
                    <Text style={styles.bookRuleResultLine}>Jenis Buku: {typeLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Ukuran: {sizeLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Model Cetak: {printModelLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Sisi Cetak: {printSideLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Bahan Isi: {insideMaterialLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Bahan Cover: {coverMaterialLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Cetak Isi: {insidePrintLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Cetak Cover: {coverPrintLabel}</Text>
                    <Text style={styles.bookRuleResultLine}>Finishing Utama: {bindingLabel}</Text>
                  </View>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.secondaryButton, wizardStep <= 1 ? styles.primaryButtonDisabled : null]}
                onPress={handlePreviousStep}
                disabled={wizardStep <= 1}
              >
                <Text style={styles.secondaryButtonText}>Kembali</Text>
              </Pressable>
              {wizardStep < totalWizardSteps ? (
                <Pressable
                  style={[styles.primaryButton, !canGoNext ? styles.primaryButtonDisabled : null]}
                  onPress={handleNextStep}
                  disabled={!canGoNext}
                >
                  <Text style={styles.primaryButtonText}>Lanjut</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryButton, !canGoNext ? styles.primaryButtonDisabled : null]}
                  onPress={closeConfigurator}
                  disabled={!canGoNext}
                >
                  <Text style={styles.primaryButtonText}>Selesai</Text>
                </Pressable>
              )}
              <Pressable style={styles.secondaryButton} onPress={closeConfigurator}>
                <Text style={styles.secondaryButtonText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BookRulePanel;
