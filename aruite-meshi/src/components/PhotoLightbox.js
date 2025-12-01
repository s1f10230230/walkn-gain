import React, { useState, useRef } from 'react';
import {
  View,
  Modal,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoLightbox({
  visible,
  photos,
  initialIndex = 0,
  onClose,
  onDelete,
  onAddPhoto,
  canAddMore,
}) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef(null);

  // インデックスが変わったら更新
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // 削除確認
  const handleDelete = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['キャンセル', 'この写真を削除'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            onDelete?.(currentIndex);
            // 最後の1枚を削除した場合は閉じる
            if (photos.length === 1) {
              onClose();
            }
          }
        }
      );
    } else {
      Alert.alert(
        '写真を削除',
        'この写真を削除しますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除',
            style: 'destructive',
            onPress: () => {
              onDelete?.(currentIndex);
              if (photos.length === 1) {
                onClose();
              }
            },
          },
        ]
      );
    }
  };

  const renderPhoto = ({ item }) => (
    <View style={styles.photoContainer}>
      <Image
        source={{ uri: item }}
        style={styles.photo}
        resizeMode="contain"
      />
    </View>
  );

  if (!photos || photos.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* 背景タップで閉じる */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* ヘッダー */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <MaterialCommunityIcons name="close" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>

          <View style={styles.headerActions}>
            {canAddMore && (
              <TouchableOpacity onPress={onAddPhoto} style={styles.headerButton}>
                <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
              <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 写真スワイプ */}
        <FlatList
          ref={flatListRef}
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item, index) => `photo-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* ページインジケーター */}
        {photos.length > 1 && (
          <View style={[styles.pagination, { paddingBottom: insets.bottom + 20 }]}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counter: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  pagination: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
