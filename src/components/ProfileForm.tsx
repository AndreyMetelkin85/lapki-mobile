import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { profileSchema, type Delivery } from '../domain';
import { useStore } from '../store';
import { Button, Field, styles } from '../ui';

/** Проверяет и отправляет нативную форму контактов с вложенным адресом доставки. */
export function ProfileForm({
  initial,
  submit,
  label = 'Сохранить',
  prefix = 'profile',
  disabled = false,
}: {
  initial: Delivery;
  submit: (value: Delivery) => Promise<void>;
  label?: string;
  prefix?: string;
  disabled?: boolean;
}) {
  const store = useStore();
  const [value, setValue] = useState(initial),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const running = useRef(false);
  async function save() {
    if (running.current || disabled) return;
    const parsed = profileSchema.safeParse(value);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.'),
            issue.message,
          ]),
        ),
      );
      return;
    }
    running.current = true;
    setErrors({});
    setBusy(true);
    try {
      await submit(parsed.data);
    } catch (e) {
      store.report(e);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const field = (
    name: 'firstName' | 'lastName' | 'phone',
    title: string,
    testName: string,
  ) => (
    <Field
      label={title}
      testID={`${prefix}-${testName}`}
      value={value[name]}
      onChangeText={(v) => setValue({ ...value, [name]: v })}
      error={errors[name]}
      editable={!busy}
      keyboardType={name === 'phone' ? 'phone-pad' : 'default'}
      maxLength={name === 'phone' ? 30 : 50}
    />
  );
  const address = (
    name: keyof Delivery['address'],
    title: string,
    testName: string,
  ) => (
    <Field
      label={title}
      testID={`${prefix}-${testName}`}
      value={value.address[name] ?? ''}
      onChangeText={(v) =>
        setValue({ ...value, address: { ...value.address, [name]: v } })
      }
      error={errors[`address.${name}`]}
      editable={!busy}
      keyboardType={name === 'postalCode' ? 'number-pad' : 'default'}
      maxLength={
        name === 'postalCode'
          ? 6
          : name === 'street'
            ? 150
            : name === 'city'
              ? 100
              : 30
      }
    />
  );
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Контакты</Text>
      <View style={styles.row}>
        {field('firstName', 'Имя', 'first-name')}
        {field('lastName', 'Фамилия', 'last-name')}
      </View>
      {field('phone', 'Телефон', 'phone')}
      <Text style={[styles.heading, { marginTop: 8 }]}>Адрес доставки</Text>
      {address('city', 'Город', 'city')}
      {address('street', 'Улица', 'street')}
      <View style={styles.row}>
        {address('house', 'Дом', 'building')}
        {address('apartment', 'Квартира', 'apartment')}
      </View>
      {address('postalCode', 'Почтовый индекс', 'postal-code')}
      <Button
        testID={`${prefix}-submit`}
        loading={busy}
        disabled={disabled}
        onPress={() => {
          void save();
        }}
      >
        {label}
      </Button>
    </View>
  );
}
