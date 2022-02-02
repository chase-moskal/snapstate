
export function pathExists(paths: string[][], path: string[]) {
	for (const comparisonPath of paths) {
		let mismatch = false
		if (path.length === comparisonPath.length) {
			for (let i = 0; i < path.length; i++) {
				if (path[i] !== comparisonPath[i]) {
					mismatch = true
					break
				}
			}
			if (!mismatch)
				return true
		}
	}
	return false
}
