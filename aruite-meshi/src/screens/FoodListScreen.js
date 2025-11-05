import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTheme } from '../utils/theme';
import { useI18n } from '../i18n/I18nProvider';
import {
  FOODS,
  FOOD_CATEGORIES,
  getFoodsByCategory,
  searchFoods,
} from '../data/foodDatabase';
import {
  getCustomFoods,
  addCustomFood,
  deleteCustomFood,
  getFavorites,
  saveFavorites,
} from '../utils/storage';

export default function FoodListScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = getTheme(colorScheme);
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [customFoods, setCustomFoods] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFood, setNewFood] = useState({
    name: '',
    emoji: '',
    calories: '',
    unit: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const custom = await getCustomFoods();
    const favs = await getFavorites();
    setCustomFoods(custom);
    setFavorites(favs);
  };

  const handleAddCustomFood = async () => {
    if (!newFood.name || !newFood.calories || !newFood.unit) {
      Alert.alert(t('common.error'), t('food.errors.required'));
      return;
    }

    const food = {
      name: newFood.name,
      emoji: newFood.emoji || '🍽️',
      calories: parseInt(newFood.calories),
      unit: newFood.unit,
      category: 'カスタム',
    };

    const added = await addCustomFood(food);
    if (added) {
      setCustomFoods([...customFoods, added]);
      setShowAddModal(false);
      setNewFood({ name: '', emoji: '', calories: '', unit: '' });
      Alert.alert(t('common.success'), t('food.added'));
    } else {
      Alert.alert(t('common.error'), t('food.addFailed'));
    }
  };

  const handleDeleteCustomFood = (food) => {
    Alert.alert(
      t('food.deleteConfirmTitle'),
      t('food.deleteConfirmMessage', { name: food.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('food.delete'),
          style: 'destructive',
          onPress: async () => {
            const success = await deleteCustomFood(food.id);
            if (success) {
              setCustomFoods(customFoods.filter(f => f.id !== food.id));
              Alert.alert(t('common.success'), t('food.deleted'));
            }
          },
        },
      ]
    );
  };

  const toggleFavorite = async (foodId) => {
    let newFavorites;
    if (favorites.includes(foodId)) {
      newFavorites = favorites.filter(id => id !== foodId);
    } else {
      newFavorites = [...favorites, foodId];
    }
    setFavorites(newFavorites);
    await saveFavorites(newFavorites);
  };

  const renderFoodItem = (food, isCustom = false) => {
    const isFavorite = favorites.includes(food.id);
    const nameKey = `food.items.${food.id}.name`;
    const unitKey = `food.items.${food.id}.unit`;
    const tName = t(nameKey);
    const tUnit = t(unitKey);
    const displayName = tName === nameKey ? food.name : tName;
    const displayUnit = tUnit === unitKey ? food.unit : tUnit;

    return (
      <View key={food.id} style={[styles.foodCard, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(food.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.favoriteIcon}>{isFavorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>

        <View style={styles.foodCardContent}>
          <Text style={styles.foodEmoji}>{food.emoji}</Text>
          <Text style={[styles.foodName, { color: theme.text }]}>{displayName}</Text>
          <View style={[styles.caloriesBadge, { backgroundColor: theme.accent + '20' }]}>
            <Text style={[styles.caloriesText, { color: theme.accent }]}>
              {food.calories}{t('units.kcal')}
            </Text>
          </View>
        </View>

        {isCustom && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCustomFood(food)}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFoodGrid = (foods, isCustom = false) => {
    const rows = [];
    for (let i = 0; i < foods.length; i += 2) {
      rows.push(
        <View key={i} style={styles.gridRow}>
          {renderFoodItem(foods[i], isCustom)}
          {foods[i + 1] ? renderFoodItem(foods[i + 1], isCustom) : <View style={styles.foodCard} />}
        </View>
      );
    }
    return rows;
  };

  const getFilteredFoods = () => {
    if (!searchQuery) return null;
    const systemFoods = searchFoods(searchQuery);
    const q = searchQuery.toLowerCase();
    const customMatches = customFoods.filter((f) =>
      (f.name || '').toLowerCase().includes(q) || (f.emoji || '').includes(searchQuery)
    );
    return [...customMatches, ...systemFoods];
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 検索バー */}
      <View style={[styles.searchContainer, { paddingTop: insets.top + 15, backgroundColor: theme.card }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: theme.background, color: theme.text }]}
          placeholder={t('food.searchPlaceholder')}
          placeholderTextColor={theme.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t('food.a11y.addCustomFood')}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>＋</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom, paddingHorizontal: 12 }}
      >
        {/* 検索結果（検索中のみ表示） */}
        {searchQuery ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🔎 {t('food.searchResults')}</Text>
            {(() => {
              const results = getFilteredFoods() || [];
              if (results.length === 0) {
                return <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>{t('food.notFound')}</Text>;
              }
              return renderFoodGrid(results, false);
            })()}
          </View>
        ) : null}

        {/* カスタム食べ物（検索していない時のみ） */}
        {!searchQuery && customFoods.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>🎨 {t('food.custom')}</Text>
            {renderFoodGrid(customFoods, true)}
          </View>
        )}

        {/* よく見る（検索していない時のみ） */}
        {!searchQuery && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>⭐ {t('food.favorites')}</Text>
            {renderFoodGrid(getFoodsByCategory(FOOD_CATEGORIES.POPULAR))}
          </View>
        )}

        {/* その他のカテゴリ（検索していない時のみ） */}
        {!searchQuery && (
          Object.entries(FOOD_CATEGORIES)
            .filter(([key, value]) => key !== 'POPULAR')
            .map(([key, value]) => {
              const foods = getFoodsByCategory(value);
              if (foods.length === 0) return null;

              return (
                <View key={key} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>{t(`food.categories.${key}`)}</Text>
                  {renderFoodGrid(foods)}
                </View>
              );
            })
        )}
      </ScrollView>

      {/* カスタム食べ物追加モーダル */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('food.addCustomTitle')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('food.namePlaceholder')}
              value={newFood.name}
              onChangeText={(text) => setNewFood({ ...newFood, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder={t('food.emojiPlaceholder')}
              value={newFood.emoji}
              onChangeText={(text) => setNewFood({ ...newFood, emoji: text })}
            />

            <TextInput
              style={styles.input}
              placeholder={t('food.caloriesPlaceholder')}
              value={newFood.calories}
              onChangeText={(text) => setNewFood({ ...newFood, calories: text })}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder={t('food.unitPlaceholder')}
              value={newFood.unit}
              onChangeText={(text) => setNewFood({ ...newFood, unit: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddCustomFood}
              >
                <Text style={styles.saveButtonText}>{t('food.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    marginLeft: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  foodCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
  favoriteIcon: {
    fontSize: 28,
  },
  foodCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  caloriesBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  caloriesText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    padding: 6,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#616161',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#FF7043',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
