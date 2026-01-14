import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Image, useWindowDimensions } from "react-native";

export default function ProTourModal({
  visible,
  onClose,
  onDone,
  onDismiss,
  slides = [],
  theme,
  t,
}) {
  const [index, setIndex] = useState(0);
  const { width: screenWidth } = useWindowDimensions();
  const modalWidth = Math.min(screenWidth - 32, 360);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const isLast = index >= slides.length - 1;
  const current = slides[index] || {};

  return (
    <Modal visible={visible} transparent animationType="fade" onDismiss={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
      >
        <View
          style={{
            width: modalWidth,
            backgroundColor: theme?.card || "#FFF",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <Text
            style={{
              color: theme?.text || "#111",
              fontWeight: "800",
              fontSize: 18,
              marginBottom: 8,
            }}
          >
            {current.title || ""}
          </Text>
          <Text
            style={{
              color: theme?.textSecondary || "#555",
              lineHeight: 20,
              marginBottom: current.image ? 12 : 16,
            }}
          >
            {current.desc || ""}
          </Text>

          {current.image && (
            <Image
              source={current.image}
              resizeMode="contain"
              style={{
                width: "100%",
                height: 220,
                borderRadius: 12,
                marginBottom: 16,
              }}
            />
          )}

          {/* Dots */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor:
                    i === index
                      ? theme?.primary || "#00A896"
                      : theme?.border || "rgba(0,0,0,0.2)",
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <TouchableOpacity
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme?.border || "rgba(0,0,0,0.1)",
                flex: 1,
              }}
              onPress={onClose}
            >
              <Text style={{ color: theme?.textSecondary || "#555", textAlign: "center", fontWeight: "700" }}>
                {t ? t("settings.premium.proTour.skip") : "Skip"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: theme?.primary || "#00A896",
                flex: 1.2,
              }}
              onPress={() => {
                if (isLast) {
                  onDone?.();
                } else {
                  setIndex((i) => Math.min(i + 1, slides.length - 1));
                }
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>
                {isLast ? t?.("settings.premium.proTour.done") || "Start Pro" : t?.("settings.premium.proTour.next") || "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
