# Word2Vec Forge · 词向量实验室

<p align="center">
  <a href="https://github.com/CJX0712/word2vec-forge/actions/workflows/ci.yml"><img src="https://github.com/CJX0712/word2vec-forge/actions/workflows/ci.yml/badge.svg" alt="ci"></a>
  <a href="https://github.com/CJX0712/word2vec-forge/releases"><img src="https://img.shields.io/github/v/release/CJX0712/word2vec-forge?sort=semver" alt="release"></a>
  <a href="https://github.com/CJX0712/word2vec-forge/blob/main/LICENSE"><img src="https://img.shields.io/github/license/CJX0712/word2vec-forge" alt="license"></a>
  <img src="https://img.shields.io/badge/author-%E6%99%A8%E6%98%9F-1f6feb" alt="author">
</p>

单文件、零依赖、离线可跑的 word2vec（skip-gram + 负采样）交互实验室。
用浏览器直接打开 `index.html` 即可，无需服务器、无需构建。

## 它做什么

- **从零手写 SGNS**：输入/输出双嵌入矩阵、unigram^0.75 负采样分布、线性学习率衰减，全部纯 JS，约 200 行。
- **结构化合成语料**：每个词由若干「特征」组成（如 `king = male + royal`），上下文词严格按特征生成 —— 词向量因此可学出可解释的方向。
- **类比推理可视化**：`king − man + woman ≈ queen`、`paris − france + germany ≈ berlin`，训练后应当稳定 top-1 命中。
- **PCA 2D 投影**、最近邻、全词表余弦相似度热力图、loss 曲线。
- **可复现**：mulberry32 种子随机数，同种子训练结果 bit 级一致。

## 可验证不变量（`_smoke.js`，Node 无头全绿）

1. **确定性**：同种子两次训练，嵌入完全相等（maxdiff = 0）
2. **梯度检验**：SGNS 解析梯度 vs 中心差分，相对误差 < 1e-6
3. **loss 收敛**：末 5 轮均值 < 首 5 轮均值
4. **类比 top-1**：king−man+woman→queen、queen−woman+man→king、paris−france+germany→berlin、berlin−germany+italy→rome
5. **语义结构**：sim(king,queen) > sim(king,farm)；nearest(crown) 命中 royal 词
6. 边界：空语料、单词表、OOV 过滤、unicode 词表
7. PCA：解释方差降序且 ∈ (0,1]；相似度矩阵对称、对角 = 1

## 运行测试

```bash
node _smoke.js    # 引擎不变量
node _probe.js    # 语义探针 dump（生成 _probe.txt）
node _uicheck.js  # DOM stub 下点遍全部 UI 控件
```

## 为什么合成语料能学出类比

`king` 只与男性词（he/him/his/brother）和皇室词（crown/throne/castle/palace）共现，
`queen` 只与女性词和皇室词共现。于是 king−queen 恰好等于「男性上下文 − 女性上下文」方向，
与 man−woman 相同 —— 加减向量后皇室成分抵消、性别成分显现。`france/paris` 系列额外共享
私有特征（seine/spree/tiber/tagus），保证「首都 − 国家」方向可跨对迁移且各词可分辨。

## License

MIT © 晨星
