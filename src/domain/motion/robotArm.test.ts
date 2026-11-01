import { describe, expect, it } from 'vitest'
import { JOINT_LIMITS, armReachProblem, forwardTool, robotArmPose, type RobotArmParams } from './robotArm'

const p: RobotArmParams = {
  origin: { x: 0, z: 0 },
  shoulderHeight: 0.9,
  upperArm: 1.0,
  forearm: 0.9,
  tool: 0.35,
  pick: { x: 1.3, y: 0.95, z: 0.4 },
  place: { x: -0.4, y: 0.95, z: -1.3 },
  cycleSeconds: 6,
}

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

const SAMPLES = 600
const timeline = Array.from({ length: SAMPLES + 1 }, (_, i) => (i / SAMPLES) * p.cycleSeconds)

describe('robotArmPose', () => {
  it('@S8 夾爪先到達取料點，再到達放料點', () => {
    const firstPick = timeline.find((t) => dist(robotArmPose(p, t).tool, p.pick) < 1e-3)
    const firstPlace = timeline.find((t) => dist(robotArmPose(p, t).tool, p.place) < 1e-3)
    expect(firstPick).toBeDefined()
    expect(firstPlace).toBeDefined()
    expect(firstPick!).toBeLessThan(firstPlace!)
  })

  it('@S8 在取料點夾緊、搬運途中保持夾緊、在放料點鬆開', () => {
    const atPick = timeline.filter((t) => dist(robotArmPose(p, t).tool, p.pick) < 1e-3)
    const atPlace = timeline.filter((t) => dist(robotArmPose(p, t).tool, p.place) < 1e-3)
    expect(robotArmPose(p, atPick[0]!).grip).toBe(0)
    expect(robotArmPose(p, atPick.at(-1)!).grip).toBe(1)
    for (const t of timeline.filter((t) => t > atPick.at(-1)! && t < atPlace[0]!)) expect(robotArmPose(p, t).grip).toBe(1)
    expect(robotArmPose(p, atPlace.at(-1)!).grip).toBe(0)
  })

  it('@S8 每個關節角度在整個週期都在限制範圍內', () => {
    for (const t of timeline) {
      const pose = robotArmPose(p, t)
      for (const joint of ['base', 'shoulder', 'elbow', 'wrist'] as const) {
        const [min, max] = JOINT_LIMITS[joint]
        expect(pose[joint], `${joint} @ t=${t}`).toBeGreaterThanOrEqual(min)
        expect(pose[joint], `${joint} @ t=${t}`).toBeLessThanOrEqual(max)
      }
    }
  })

  it('回報的夾爪位置等於關節角的正向運動學結果（畫面與數據一致）', () => {
    for (const t of timeline.filter((_, i) => i % 25 === 0)) {
      const pose = robotArmPose(p, t)
      expect(dist(pose.tool, forwardTool(p, pose))).toBeLessThan(1e-9)
    }
  })

  it('動作連續：相鄰取樣之間夾爪移動距離有上限（不瞬移）', () => {
    for (let i = 1; i < timeline.length; i++) {
      expect(dist(robotArmPose(p, timeline[i]!).tool, robotArmPose(p, timeline[i - 1]!).tool)).toBeLessThan(0.05)
    }
  })

  it('@S8 夾持狀態（carrying）由領域層決定：取料後為真、放料後為假（3D 與 2D 共用）', () => {
    const atPick = timeline.filter((t) => dist(robotArmPose(p, t).tool, p.pick) < 1e-3)
    const atPlace = timeline.filter((t) => dist(robotArmPose(p, t).tool, p.place) < 1e-3)
    expect(robotArmPose(p, atPick[0]!).carrying).toBe(false)
    for (const t of timeline.filter((t) => t > atPick.at(-1)! && t < atPlace[0]!)) expect(robotArmPose(p, t).carrying).toBe(true)
    expect(robotArmPose(p, atPlace.at(-1)!).carrying).toBe(false)
    expect(robotArmPose(p, 0).carrying).toBe(false)
  })
})

describe('armReachProblem', () => {
  it('@S3 可達的取放點 → null；太遠或太近 → 說明哪個點位', () => {
    expect(armReachProblem(p)).toBeNull()
    expect(armReachProblem({ ...p, pick: { x: 3.5, y: 0.95, z: 0 } })).toMatch(/^取料點超出/)
    expect(armReachProblem({ ...p, place: { x: 0.03, y: 0.5, z: 0 } })).toMatch(/^放料點太靠近/)
  })

  it('@S3 五個路徑點都可達、但移動途中肘關節會超出限制 → 回報途中問題', () => {
    const q = { ...p, pick: { x: 0.3, y: 0, z: 0 }, place: { x: -0.3, y: 0.9, z: 0 } }
    const problem = armReachProblem(q)
    expect(problem).toMatch(/途中/)
    // 對照：實際姿態確實會超出限制（證明這不是誤報）
    const N = 600
    const exceeds = Array.from({ length: N }, (_, i) => robotArmPose(q, (i / N) * q.cycleSeconds)).some((s) => s.elbow < JOINT_LIMITS.elbow[0] || s.elbow > JOINT_LIMITS.elbow[1])
    expect(exceeds).toBe(true)
  })
})
