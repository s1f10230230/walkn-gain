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
} from 'react-native';
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

export default function FoodListScreen({ navigation }) {
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
      Alert.alert('エラー', 'すべての項目を入力してください');
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
      Alert.alert('成功', '食べ物を追加しました');
    } else {
      Alert.alert('エラー', '追加に失敗しました');
    }
  };

  const handleDeleteCustomFood = (food) => {
    Alert.alert(
      '削除確認',
      `${food.name}を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteCustomFood(food.id);
            if (success) {
              setCustomFoods(customFoods.filter(f => f.id !== food.id));
              Alert.alert('成功', '削除しました');
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

    return (
      <View key={food.id} style={styles.foodItem}>
        <TouchableOpacity
          style={styles.foodItemContent}
          onPress={() => toggleFavorite(food.id)}
        >
          <Text style={styles.foodEmoji}>{food.emoji}</Text>
          <View style={styles.foodInfo}>
            <Text style={styles.foodName}>{food.name}</Text>
            <Text style={styles.foodCalories}>{food.calories}kcal</Text>
          </View>
          <Text style={styles.favoriteIcon}>{isFavorite ? '⭐' : '☆'}</Text>
        </TouchableOpacity>
        {isCustom && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCustomFood(food)}
          >
            <Text style={styles.deleteButtonText}>削除</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getFilteredFoods = () => {
    if (searchQuery) {
      return searchFoods(searchQuery);
    }
    return FOODS;
  };

  return (
    <View style={styles.container}>
      {/* 検索バー */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="食べ物を検索..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ 追加</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* カスタム食べ物 */}
        {customFoods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>カスタム</Text>
            {customFoods.map(food => renderFoodItem(food, true))}
          </View>
        )}

        {/* よく見る */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ よく見る</Text>
          {getFoodsByCategory(FOOD_CATEGORIES.POPULAR).map(food =>
            renderFoodItem(food)
          )}
        </View>

        {/* その他のカテゴリ */}
        {Object.values(FOOD_CATEGORIES)
          .filter(cat => cat !== FOOD_CATEGORIES.POPULAR)
          .map(category => {
            const foods = getFoodsByCategory(category);
            if (foods.length === 0) return null;

            return (
              <View key={category} style={styles.section}>
                <Text style={styles.sectionTitle}>{category}</Text>
                {foods.map(food => renderFoodItem(food))}
              </View>
            );
          })}
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
            <Text style={styles.modalTitle}>カスタム食べ物を追加</Text>

            <TextInput
              style={styles.input}
              placeholder="名前（例: カスタムラーメン）"
              value={newFood.name}
              onChangeText={(text) => setNewFood({ ...newFood, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="絵文字（例: 🍜）"
              value={newFood.emoji}
              onChangeText={(text) => setNewFood({ ...newFood, emoji: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="カロリー（例: 500）"
              value={newFood.calories}
              onChangeText={(text) => setNewFood({ ...newFood, calories: text })}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="単位（例: 杯）"
              value={newFood.unit}
              onChangeText={(text) => setNewFood({ ...newFood, unit: text })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddCustomFood}
              >
                <Text style={styles.saveButtonText}>追加</Text>
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
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#FFF',
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  foodItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  foodEmoji: {
    fontSize: 30,
    marginRight: 15,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  foodCalories: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  favoriteIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#333',
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
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
