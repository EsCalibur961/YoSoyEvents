import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getAdminProfileImage, isRemoteProfileImage } from "../utils/profileImages";

export async function migrateLegacyAdminProfile() {
  const role = await AsyncStorage.getItem("loggedUser");
  if (role !== "admin") return;

  const values = await AsyncStorage.multiGet(["adminProfileImage", "profileImage", "adminName", "loggedUserName"]);
  const cached = Object.fromEntries(values);
  const legacyImage = cached.adminProfileImage || cached.profileImage || "";
  if (!isRemoteProfileImage(legacyImage)) return;

  const profileRef = doc(db, "settings", "adminProfile");
  const profile = await getDoc(profileRef);
  if (!getAdminProfileImage(profile.data() as Record<string, unknown> | undefined)) {
    await setDoc(profileRef, {
      name: cached.adminName || cached.loggedUserName || "YoSoyEvents",
      image: legacyImage,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  await AsyncStorage.multiRemove(["adminProfileImage", "profileImage"]);
}
