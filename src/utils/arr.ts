/**
 * 
 * @param arr number[]
 * @returns boolean 
 * @example
 * const data1 = [1, 2, 3, 4, 5]
 * const data2 = [2, 3, 5, 6]
 * 
 * console.log(isSequential(data1)) // output: true 
 * console.log(isSequential(data2)) // output: false 
 */
export function isSequential(arr: number[]): boolean {
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] !== arr[i - 1] + 1) {
            return false;
        }
    }
    return true;
}