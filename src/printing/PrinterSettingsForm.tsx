import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { DEFAULT_CHARS_PER_LINE, resolveDefaultCharsPerLine } from './profiles';
import type { PaperWidth, PrinterConnection, PrinterProfile, PrinterType } from './types';

interface PrinterSettingsFormProps {
  value: PrinterProfile;
  onChange: (next: PrinterProfile) => void;
  onTestPrint?: () => void;
}

const PRINTER_TYPES: PrinterType[] = ['thermal_escpos', 'browser', 'dot_matrix'];
const CONNECTION_TYPES: PrinterConnection[] = ['browser', 'qz_tray', 'usb', 'bluetooth', 'lan', 'wifi', 'local_service'];
const PAPER_WIDTHS: PaperWidth[] = ['58mm', '80mm', 'custom'];

const buttonStyle = (active: boolean) => [styles.optionButton, active ? styles.optionButtonActive : null];
const buttonTextStyle = (active: boolean) => [styles.optionButtonText, active ? styles.optionButtonTextActive : null];
const PRESET_PROFILES = [
  {
    key: 'thermal58',
    label: 'Thermal 58mm',
    patch: {
      type: 'thermal_escpos' as PrinterType,
      connection: 'qz_tray' as PrinterConnection,
      paperWidth: '58mm' as PaperWidth,
      charsPerLine: DEFAULT_CHARS_PER_LINE['58mm'],
      cutter: true,
    },
  },
  {
    key: 'thermal80',
    label: 'Thermal 80mm',
    patch: {
      type: 'thermal_escpos' as PrinterType,
      connection: 'qz_tray' as PrinterConnection,
      paperWidth: '80mm' as PaperWidth,
      charsPerLine: DEFAULT_CHARS_PER_LINE['80mm'],
      cutter: true,
    },
  },
  {
    key: 'browser',
    label: 'Browser / A4',
    patch: {
      type: 'browser' as PrinterType,
      connection: 'browser' as PrinterConnection,
      paperWidth: 'custom' as PaperWidth,
      charsPerLine: DEFAULT_CHARS_PER_LINE.custom,
      cutter: false,
    },
  },
];

export default function PrinterSettingsForm({
  value,
  onChange,
  onTestPrint,
}: PrinterSettingsFormProps) {
  const current = useMemo(() => ({
    ...value,
    charsPerLine: Number(value.charsPerLine || 0) || DEFAULT_CHARS_PER_LINE.custom,
  }), [value]);

  const patch = (partial: Partial<PrinterProfile>) => {
    onChange({ ...current, ...partial });
  };

  const handlePaperWidthChange = (paperWidth: PaperWidth) => {
    if (paperWidth === 'custom') {
      patch({ paperWidth, charsPerLine: current.paperWidth === 'custom' ? current.charsPerLine : DEFAULT_CHARS_PER_LINE.custom });
      return;
    }

    patch({
      paperWidth,
      charsPerLine: resolveDefaultCharsPerLine(paperWidth),
    });
  };

  const applyPreset = (preset: typeof PRESET_PROFILES[number]) => {
    patch(preset.patch);
  };

  const handlePrinterTypeChange = (type: PrinterType) => {
    if (type === 'browser') {
      patch({
        type,
        connection: 'browser',
        paperWidth: 'custom',
        charsPerLine: DEFAULT_CHARS_PER_LINE.custom,
      });
      return;
    }
    patch({
      type,
      paperWidth: current.paperWidth === 'custom' ? '58mm' : current.paperWidth,
      charsPerLine: current.paperWidth === '80mm'
        ? DEFAULT_CHARS_PER_LINE['80mm']
        : DEFAULT_CHARS_PER_LINE['58mm'],
    });
  };

  const handleConnectionChange = (connection: PrinterConnection) => {
    if (connection === 'browser') {
      patch({
        connection,
        type: 'browser',
        paperWidth: 'custom',
        charsPerLine: DEFAULT_CHARS_PER_LINE.custom,
      });
      return;
    }
    patch({
      connection,
      type: current.type === 'browser' ? 'thermal_escpos' : current.type,
      paperWidth: current.paperWidth === 'custom' ? '58mm' : current.paperWidth,
      charsPerLine: current.paperWidth === '80mm'
        ? DEFAULT_CHARS_PER_LINE['80mm']
        : DEFAULT_CHARS_PER_LINE['58mm'],
    });
  };

  const paperHint = current.paperWidth === '58mm'
    ? 'Cocok untuk thermal kecil 58mm.'
    : current.paperWidth === '80mm'
      ? 'Cocok untuk thermal besar 80mm.'
      : 'Custom dipakai untuk browser/A4 atau printer non-thermal.';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Setting Printer</Text>

      <Text style={styles.label}>Preset Cepat</Text>
      <View style={styles.rowWrap}>
        {PRESET_PROFILES.map((preset) => (
          <Pressable key={preset.key} style={styles.presetButton} onPress={() => applyPreset(preset)}>
            <Text style={styles.presetButtonText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Nama Printer Profile</Text>
      <TextInput value={current.name} onChangeText={(name) => patch({ name })} style={styles.input} />

      <Text style={styles.label}>Tipe Printer</Text>
      <View style={styles.rowWrap}>
        {PRINTER_TYPES.map((option) => {
          const active = current.type === option;
          return (
            <Pressable key={option} style={buttonStyle(active)} onPress={() => handlePrinterTypeChange(option)}>
              <Text style={buttonTextStyle(active)}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Connection</Text>
      <View style={styles.rowWrap}>
        {CONNECTION_TYPES.map((option) => {
          const active = current.connection === option;
          return (
            <Pressable key={option} style={buttonStyle(active)} onPress={() => handleConnectionChange(option)}>
              <Text style={buttonTextStyle(active)}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Paper Width</Text>
      <View style={styles.rowWrap}>
        {PAPER_WIDTHS.map((option) => {
          const active = current.paperWidth === option;
          return (
            <Pressable key={option} style={buttonStyle(active)} onPress={() => handlePaperWidthChange(option)}>
              <Text style={buttonTextStyle(active)}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helperText}>{paperHint}</Text>

      <Text style={styles.label}>Characters Per Line</Text>
      <TextInput
        value={String(current.charsPerLine || '')}
        keyboardType="numeric"
        onChangeText={(charsPerLine) => patch({ charsPerLine: Number(charsPerLine.replace(/[^0-9]/g, '')) || 0 })}
        style={styles.input}
      />

      <Text style={styles.label}>Printer Name</Text>
      <TextInput value={current.printerName || ''} onChangeText={(printerName) => patch({ printerName })} style={styles.input} />

      <Text style={styles.label}>IP Address</Text>
      <TextInput value={current.ipAddress || ''} onChangeText={(ipAddress) => patch({ ipAddress })} style={styles.input} />

      <Text style={styles.label}>Port</Text>
      <TextInput
        value={current.port ? String(current.port) : ''}
        keyboardType="numeric"
        onChangeText={(port) => patch({ port: Number(port.replace(/[^0-9]/g, '')) || undefined })}
        style={styles.input}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Cutter</Text>
        <Switch value={Boolean(current.cutter)} onValueChange={(cutter) => patch({ cutter })} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Cash Drawer</Text>
        <Switch value={Boolean(current.cashDrawer)} onValueChange={(cashDrawer) => patch({ cashDrawer })} />
      </View>

      <Pressable style={styles.testButton} onPress={onTestPrint}>
        <Text style={styles.testButtonText}>Test Print</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#b8b8b8',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16387c',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  helperText: {
    marginTop: -2,
    fontSize: 10,
    color: '#5d6780',
  },
  input: {
    borderWidth: 1,
    borderColor: '#b8b8b8',
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#1f1f1f',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetButton: {
    borderWidth: 1,
    borderColor: '#8ca2d8',
    backgroundColor: '#eef3ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetButtonText: {
    color: '#1f418f',
    fontSize: 12,
    fontWeight: '700',
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#a5a5a5',
    backgroundColor: '#efefef',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionButtonActive: {
    borderColor: '#2457d6',
    backgroundColor: '#2f64ef',
  },
  optionButtonText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },
  optionButtonTextActive: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
  testButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#2457d6',
    backgroundColor: '#2f64ef',
    paddingVertical: 10,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
