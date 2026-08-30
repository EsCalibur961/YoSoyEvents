type ProfileRecord = Record<string, unknown> | null | undefined;

const remoteImageUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  const url = value.trim();
  return /^https?:\/\//i.test(url) ? url : "";
};

export const getTeacherProfileImage = (teacher: ProfileRecord) => {
  if (!teacher) return "";
  return (
    remoteImageUrl(teacher.profileImage) ||
    remoteImageUrl(teacher.image) ||
    remoteImageUrl(teacher.photoURL) ||
    remoteImageUrl(teacher.photoUrl) ||
    remoteImageUrl(teacher.profilePicture) ||
    remoteImageUrl(teacher.profilePhoto) ||
    remoteImageUrl(teacher.avatar) ||
    remoteImageUrl(teacher.imageUrl)
  );
};

export const getAdminProfileImage = (profile: ProfileRecord) => {
  if (!profile) return "";
  return (
    remoteImageUrl(profile.image) ||
    remoteImageUrl(profile.adminProfileImage) ||
    remoteImageUrl(profile.profileImage) ||
    remoteImageUrl(profile.photoURL) ||
    remoteImageUrl(profile.photoUrl) ||
    remoteImageUrl(profile.avatar)
  );
};

export const isRemoteProfileImage = (value: unknown) => Boolean(remoteImageUrl(value));
