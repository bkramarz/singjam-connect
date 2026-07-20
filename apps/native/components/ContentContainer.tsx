import { View, type ViewStyle } from 'react-native';

// Mirrors web's `max-w-4xl` (56rem = 896px) content column in apps/web/app/layout.tsx,
// which centers page content on wide screens. Native screens otherwise run
// edge-to-edge on tablets, so we cap and center the content column the same way.
export const CONTENT_MAX_WIDTH = 896;

export const contentWidthStyle: ViewStyle = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
};

export default function ContentContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[{ flex: 1 }, contentWidthStyle, style]}>{children}</View>;
}
