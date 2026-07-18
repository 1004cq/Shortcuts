# 快捷指令原生接听（不用开浏览器）

管理员点播放后，iPhone **快捷指令**通过 long-poll 拉指令并「播放声音」。

## 轮询地址

```
https://cq.imim.chat/realtime/api/poll?userId=你的ID&token=TOKEN&wait=25
```

也可在后台「远程音频」→ 生成快捷指令配置 → 复制。

## 捷径步骤

1. 重复 9999 次  
2. 获取 URL 内容 → 上面的 poll 地址（GET）  
3. 获取词典  
4. 如果 `pending` 为真：  
   - 获取词典值 `audioUrl`  
   - 获取 URL 内容（该音频）  
   - 播放声音  
5. 运行捷径即可接听（不必开 Safari）

## 限制

锁屏后 iOS 可能暂停捷径；亮屏再点运行即可。无法做到完全静默的 7×24 后台。
