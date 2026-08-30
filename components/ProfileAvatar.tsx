import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, ImageStyle, StyleProp, View, ViewStyle } from "react-native";

type Props = {
  uri?: string;
  size?: number;
  color: string;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
};

export function ProfileAvatar({ uri = "", size = 44, color, backgroundColor, style }: Props) {
  const [failedUri, setFailedUri] = useState("");
  useEffect(() => setFailedUri(""), [uri]);

  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  if (uri && failedUri !== uri) {
    return <Image key={uri} source={{ uri }} style={[dimensions, style as StyleProp<ImageStyle>]} resizeMode="cover" onError={() => setFailedUri(uri)} />;
  }

  return <View style={[dimensions, style, { backgroundColor, alignItems: "center", justifyContent: "center" }]}><Ionicons name="person-outline" size={Math.round(size * 0.48)} color={color} /></View>;
}
