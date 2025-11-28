import ExpoModulesCore
import HealthKit

public class HealthKitSwiftModule: Module {
  private let healthStore = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("HealthKitSwift")

    // HealthKitが利用可能かチェック
    Function("isAvailable") { () -> Bool in
      return HKHealthStore.isHealthDataAvailable()
    }

    // 権限リクエスト
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        DispatchQueue.main.async {
          promise.resolve(false)
        }
        return
      }

      guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        DispatchQueue.main.async {
          promise.resolve(false)
        }
        return
      }

      let typesToRead: Set<HKObjectType> = [stepType]

      self.healthStore.requestAuthorization(toShare: nil, read: typesToRead) { success, error in
        DispatchQueue.main.async {
          if let error = error {
            print("[HealthKitSwift] Authorization error: \(error.localizedDescription)")
            promise.resolve(false)
          } else {
            print("[HealthKitSwift] Authorization success: \(success)")
            promise.resolve(success)
          }
        }
      }
    }

    // 指定日の歩数を取得
    AsyncFunction("getStepsForDate") { (dateString: String, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(0)
        return
      }

      guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(0)
        return
      }

      // 日付パース (YYYY-MM-DD)
      let formatter = DateFormatter()
      formatter.dateFormat = "yyyy-MM-dd"
      formatter.timeZone = TimeZone.current

      guard let date = formatter.date(from: dateString) else {
        promise.resolve(0)
        return
      }

      let calendar = Calendar.current
      let startOfDay = calendar.startOfDay(for: date)
      guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
        promise.resolve(0)
        return
      }

      let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

      let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
        if let error = error {
          print("[HealthKitSwift] Query error for \(dateString): \(error.localizedDescription)")
          promise.resolve(0)
          return
        }

        let steps = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
        promise.resolve(Int(steps))
      }

      self.healthStore.execute(query)
    }

    // 過去N日分の歩数を一括取得（メイン機能）
    AsyncFunction("getStepsForDays") { (days: Int, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        DispatchQueue.main.async {
          promise.resolve([:] as [String: Int])
        }
        return
      }

      guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        DispatchQueue.main.async {
          promise.resolve([:] as [String: Int])
        }
        return
      }

      let calendar = Calendar.current
      let now = Date()
      let startOfToday = calendar.startOfDay(for: now)

      guard let startDate = calendar.date(byAdding: .day, value: -days + 1, to: startOfToday),
            let endDate = calendar.date(byAdding: .day, value: 1, to: startOfToday) else {
        DispatchQueue.main.async {
          promise.resolve([:] as [String: Int])
        }
        return
      }

      let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)

      var interval = DateComponents()
      interval.day = 1

      let query = HKStatisticsCollectionQuery(
        quantityType: stepType,
        quantitySamplePredicate: predicate,
        options: .cumulativeSum,
        anchorDate: startDate,
        intervalComponents: interval
      )

      query.initialResultsHandler = { _, results, error in
        DispatchQueue.main.async {
          if let error = error {
            print("[HealthKitSwift] Collection query error: \(error.localizedDescription)")
            promise.resolve([:] as [String: Int])
            return
          }

          var stepsDict: [String: Int] = [:]
          let formatter = DateFormatter()
          formatter.dateFormat = "yyyy-MM-dd"
          formatter.timeZone = TimeZone.current

          results?.enumerateStatistics(from: startDate, to: endDate) { statistics, _ in
            let dateKey = formatter.string(from: statistics.startDate)
            let steps = statistics.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
            stepsDict[dateKey] = Int(steps)
          }

          print("[HealthKitSwift] Fetched \(stepsDict.count) days of step data")
          promise.resolve(stepsDict)
        }
      }

      self.healthStore.execute(query)
    }

    // 今日の歩数をリアルタイム取得
    AsyncFunction("getTodaySteps") { (promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(0)
        return
      }

      guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(0)
        return
      }

      let calendar = Calendar.current
      let now = Date()
      let startOfDay = calendar.startOfDay(for: now)

      let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: now, options: .strictStartDate)

      let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
        if let error = error {
          print("[HealthKitSwift] Today query error: \(error.localizedDescription)")
          promise.resolve(0)
          return
        }

        let steps = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
        promise.resolve(Int(steps))
      }

      self.healthStore.execute(query)
    }

    // 指定日の時間帯別歩数を取得
    AsyncFunction("getHourlyStepsForDate") { (dateString: String, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable() else {
        promise.resolve(Array(repeating: 0, count: 24))
        return
      }

      guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
        promise.resolve(Array(repeating: 0, count: 24))
        return
      }

      let formatter = DateFormatter()
      formatter.dateFormat = "yyyy-MM-dd"
      formatter.timeZone = TimeZone.current

      guard let date = formatter.date(from: dateString) else {
        promise.resolve(Array(repeating: 0, count: 24))
        return
      }

      let calendar = Calendar.current
      let startOfDay = calendar.startOfDay(for: date)
      guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
        promise.resolve(Array(repeating: 0, count: 24))
        return
      }

      let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

      var interval = DateComponents()
      interval.hour = 1

      let query = HKStatisticsCollectionQuery(
        quantityType: stepType,
        quantitySamplePredicate: predicate,
        options: .cumulativeSum,
        anchorDate: startOfDay,
        intervalComponents: interval
      )

      query.initialResultsHandler = { _, results, error in
        if let error = error {
          print("[HealthKitSwift] Hourly query error: \(error.localizedDescription)")
          promise.resolve(Array(repeating: 0, count: 24))
          return
        }

        var hourlySteps = Array(repeating: 0, count: 24)

        results?.enumerateStatistics(from: startOfDay, to: endOfDay) { statistics, _ in
          let hour = calendar.component(.hour, from: statistics.startDate)
          let steps = statistics.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
          if hour >= 0 && hour < 24 {
            hourlySteps[hour] = Int(steps)
          }
        }

        promise.resolve(hourlySteps)
      }

      self.healthStore.execute(query)
    }
  }
}
