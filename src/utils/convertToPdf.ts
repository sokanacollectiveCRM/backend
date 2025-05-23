import convertToPdfCallback from 'docx-pdf'

export default function convertToPdf(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    convertToPdfCallback(inputPath, outputPath, (err, result) => {
      if (err) return reject(err)
      resolve()
    })
  })
}