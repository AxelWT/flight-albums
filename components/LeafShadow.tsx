'use client'

/**
 * 树叶阴影 —— 复刻 lefos.com 的 WebGL 视频叠加。
 *
 * 离屏 <video>（循环、静音）播放本地素材，逐帧用 WebGL 画到一块全屏画布上，
 * 画布以 mix-blend-multiply 叠加在页面之下，模拟阳光透过枝叶落在纸面上的阴影。
 * 素材位于 /public，运行时通过 /shadows-loop-*.mp4|webm 加载，不依赖外部 CDN。
 *
 * 主题切换由 CSS 控制（html.dark 下 .leaf-shadow opacity 更高），本组件不读主题。
 * props.shadowEnabled 控制是否挂载（首页门厅恒为开启）。
 */
import { useEffect, useRef } from 'react'

const MP4_SRC = '/shadows-loop-ohxjmG36.mp4'
const WEBM_SRC = '/shadows-loop-BNkFg5ea.webm'

const VERT = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

const FRAG = `
  precision mediump float;
  uniform sampler2D u_video;
  varying vec2 v_texCoord;
  void main() {
    gl_FragColor = texture2D(u_video, v_texCoord);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  return shader
}

export default function LeafShadow({ shadowEnabled }: { shadowEnabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!shadowEnabled) return
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl')
    if (!gl) return

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    // 全屏三角带
    const posBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // 纹理坐标（初始平铺，动态 cover 时重算）
    const texBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    const texLoc = gl.getAttribLocation(program, 'a_texCoord')
    gl.enableVertexAttribArray(texLoc)
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)

    const tex = gl.createTexture()
    if (!tex) return
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.uniform1i(gl.getUniformLocation(program, 'u_video'), 0)

    // 离屏视频
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = true
    video.setAttribute('playsinline', '')
    const sourceMp4 = document.createElement('source')
    sourceMp4.src = MP4_SRC
    sourceMp4.type = 'video/mp4'
    video.appendChild(sourceMp4)
    const sourceWebm = document.createElement('source')
    sourceWebm.src = WEBM_SRC
    sourceWebm.type = 'video/webm'
    video.appendChild(sourceWebm)

    // 视频尺寸与画布尺寸（DPR 感知），画布做 cover 居中截取
    let ready = false
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      if (video.videoWidth && video.videoHeight) {
        const cw = canvas.width / canvas.height
        const vw = video.videoWidth / video.videoHeight
        let nx = 0
        let ny = 0
        let nw = 1
        let nh = 1
        if (vw > cw) {
          nx = (1 - cw / vw) / 2
          nw = 1 - nx * 2
        } else {
          ny = (1 - vw / cw) / 2
          nh = 1 - ny * 2
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuf)
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([
            nx, ny,
            nx + nw, ny,
            nx, ny + nh,
            nx + nw, ny + nh,
          ]),
          gl.STATIC_DRAW,
        )
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)
      }
    }

    const draw = () => {
      if (ready && !video.paused && !video.ended) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    // 优先用 requestVideoFrameCallback，退化到 rAF
    const hasVF = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    let raf = 0
    const frame = () => {
      if (video.paused || video.ended) {
        raf = 0
        return
      }
      draw()
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (raf === 0 && ready) {
        raf = requestAnimationFrame(frame)
      }
    }
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    video.addEventListener('playing', start)
    video.addEventListener('pause', stop)

    // 减少动态效果：关掉自动播放
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => {
      if (motion.matches) video.pause()
      else video.play().catch(() => {})
    }

    video.addEventListener('loadeddata', () => {
      ready = true
      resize()
      syncMotion()
    })
    video.addEventListener('error', () => {
      ready = false
    })

    window.addEventListener('resize', resize)
    motion.addEventListener('change', syncMotion)
    resize()
    video.load()

    return () => {
      stop()
      video.removeEventListener('playing', start)
      video.removeEventListener('pause', stop)
      video.removeEventListener('loadeddata', syncMotion)
      video.removeEventListener('error', syncMotion)
      window.removeEventListener('resize', resize)
      motion.removeEventListener('change', syncMotion)
      video.pause()
      video.remove()
    }
  }, [shadowEnabled])

  if (!shadowEnabled) return null

  return <canvas ref={canvasRef} className="leaf-shadow" aria-hidden="true" />
}