// 全局按压反馈组件：用法与 Pressable 一致，按下时轻微缩放 + 降低不透明度，抬起弹回。
// 动画基于 RN 内置 Animated（useNativeDriver），不引入任何依赖；
// disabled 状态不响应也不动画。所有页面的主操作按钮统一用它，保持手感一致。
import React from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export interface PressFXProps extends Omit<PressableProps, 'style'> {
  /** 与原 Pressable 一致的样式（含条件 false 项）；施加在外层动画容器上 */
  style?: StyleProp<ViewStyle>;
}

const SPRING_CONFIG = { friction: 9, tension: 160, useNativeDriver: true } as const;

export default function PressFX({ style, children, disabled, onPressIn, onPressOut, ...rest }: PressFXProps) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const pressIn = React.useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      if (!disabled) Animated.spring(scale, { toValue: 0.97, ...SPRING_CONFIG }).start();
      onPressIn?.(e);
    },
    [disabled, scale, onPressIn],
  );

  const pressOut = React.useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      Animated.spring(scale, { toValue: 1, ...SPRING_CONFIG }).start();
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={children === undefined ? s.fill : undefined}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
});
