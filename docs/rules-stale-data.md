# 캐시/ref 동기화 패턴

## 핵심 규칙

`배열[idx] = newObj` 패턴 사용 시 해당 객체를 참조하는 다른 ref가 있는지 **반드시** 확인한다.

## 예시

```typescript
// BAD - panelIssue가 옛 객체를 가리킴
issues.value[idx] = data

// GOOD - 관련 ref도 함께 동기화
issues.value[idx] = data
if (panelIssue.value?.id === data.id) {
  panelIssue.value = data
}
```

## 체크리스트

- [ ] 배열 요소를 교체하는 코드인가?
- [ ] 같은 객체를 참조하는 다른 ref/변수가 있는가?
- [ ] 있다면 함께 동기화했는가?
